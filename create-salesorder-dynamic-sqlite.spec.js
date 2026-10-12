const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();

async function gotoApp(page, url) {
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return;
        } catch (error) {
            lastError = error;
            if (!String(error).includes('ERR_CONNECTION_REFUSED') || attempt === 5) {
                throw error;
            }
            await page.waitForTimeout(1000);
        }
    }
    throw lastError;
}

test.use({
    httpCredentials: {
        username: 'alice',
        password: '123'
    }
});

test('Create Sales Order dynamic sqlite to ods', async ({ page }) => {
    test.setTimeout(120000);

    const envVar = process.env.SLICE_ENV || '1';
    console.log(`Using Environment Variable (SLICE_ENV): ${envVar}`);
    
    let customerName = "user3";
    let customerEmail = "user3@example.com";
    let latitude = "70.0";
    let longitude = "-18.0";
    let items = [];

    const dbPath = path.join(__dirname, 'db.sqlite');
    
    // 1. Fetch from database
    const fetchItems = () => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) reject(err);
            });

            // If SLICE_ENV=1, offset=0. If SLICE_ENV=2, offset=2.
            const envNum = parseInt(envVar, 10);
            const offset = isNaN(envNum) || envNum < 1 ? 0 : (envNum - 1) * 2;

            const query = `SELECT ProductId, StockQuantity FROM swa_WarehouseInventory LIMIT 2 OFFSET ${offset}`;
            
            db.all(query, [], (err, rows) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    };

    const dbRows = await fetchItems();
    if (dbRows.length === 0) {
        throw new Error("No items found in the database for the given offset.");
    }
    
    // 2. Modify quantities and prepare data for ODS
    const sheetData = [["ProductId", "Quantity"]];
    for (const row of dbRows) {
        const originalQty = row.StockQuantity || 0;
        let newQty = 0;
        
        if (originalQty > 1) {
            // Subtract a random number that is less than originalQty
            // Let randomSub be in range [1, originalQty - 1]
            const randomSub = Math.floor(Math.random() * (originalQty - 1)) + 1;
            newQty = originalQty - randomSub;
            console.log(`ProductId ${row.ProductId}: Original stock was ${originalQty}, subtracted ${randomSub}, new quantity is ${newQty}`);
        } else if (originalQty === 1) {
            newQty = 1;
            console.log(`ProductId ${row.ProductId}: Original stock was 1, keeping quantity as 1 (cannot subtract random > 0)`);
        } else {
            console.log(`ProductId ${row.ProductId}: Original stock was 0, keeping quantity as 0`);
        }
        
        sheetData.push([row.ProductId, newQty]);
    }

    // 3. Dynamically write to ODS file
    const odsPath = path.join(__dirname, 'DynamicItems.ods');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(sheetData);
    xlsx.utils.book_append_sheet(wb, ws, "Items");
    xlsx.writeFile(wb, odsPath, { bookType: "ods" });
    console.log(`Dynamically generated ODS file at ${odsPath}`);

    // 4. Read the items back from the ODS file
    const readWb = xlsx.readFile(odsPath);
    const readWs = readWb.Sheets[readWb.SheetNames[0]];
    const readData = xlsx.utils.sheet_to_json(readWs);

    items = readData.map(row => ({
        productId: row.ProductId,
        quantity: row.Quantity
    }));
    
    console.log("Items read from ODS to be ordered:", items);





    
    // Sales Order via UI
    console.log("\nNavigating to app...");
    const url = process.env.APP_URL || 'http://127.0.0.1:4004/v2wa/index.html#Shell-home';
    await gotoApp(page, url);

    if (page.url().includes('#Shell-home')) {
        console.log("On Fiori Launchpad, clicking the app tile...");
        const tile = page.getByText('Smart Warehouse Allocation').first();
        await tile.waitFor({ state: 'visible', timeout: 30000 });
        await tile.click();
    }

    const createBtn = page.getByRole('button', { name: 'Create Order' });
    await createBtn.waitFor({ state: 'visible', timeout: 30000 });
    await createBtn.click();

    const inputs = page.locator('input.sapMInputBaseInner');
    await inputs.nth(0).waitFor({ state: 'visible', timeout: 5000 });

    await inputs.nth(0).fill(customerName);
    await inputs.nth(1).fill(customerEmail);
    await inputs.nth(2).fill(latitude);
    await inputs.nth(3).fill(longitude);

    for (let i = 0; i < items.length; i++) {
        await page.getByRole('button', { name: 'Add Item' }).click();
        
        const pIdIndex = 4 + (i * 2);
        const qtyIndex = pIdIndex + 1;

        await inputs.nth(pIdIndex).waitFor({ state: 'visible', timeout: 5000 });
        
        await inputs.nth(pIdIndex).fill(items[i].productId.toString());
        
        let qty = parseFloat(items[i].quantity);
        if (isNaN(qty)) qty = 0;
        await inputs.nth(qtyIndex).fill(qty.toString());
    }

    const dialog = page.locator('.sapMDialog');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    
    await page.waitForSelector('.sapMMessageToast:has-text("Sales Order created successfully.")', { timeout: 10000 });
    console.log("Success! Sales Order was created.");
    await page.waitForTimeout(3000);
});
