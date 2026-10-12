/*
const { chromium } = require('playwright');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

(async () => {
    try {
        console.log("Please provide the following details for the new Sales Order:");
        const customerName = await askQuestion("Customer Name: ");
        const customerEmail = await askQuestion("Customer Email: ");
        const latitude = await askQuestion("Latitude: ");
        const longitude = await askQuestion("Longitude: ");
        const numItemsInput = await askQuestion("Number of Items: ");
        const numItems = parseInt(numItemsInput, 10) || 1;
        const items = [];
        
        for (let i = 0; i < numItems; i++) {
            console.log(`\nItem ${i + 1}:`);
            const productId = await askQuestion("Product ID: ");
            const quantity = await askQuestion("Quantity: ");
            items.push({ productId, quantity });
        }
        
        rl.close();

        console.log("\nStarting Playwright browser...");
        


        const browser = await chromium.launch({ headless: false }); 
        const context = await browser.newContext({
            // Handling basic auth (alice / <any-password> based on your package.json)
            httpCredentials: {
                username: 'alice',
                password: '123'
            }
        });
        const page = await context.newPage();

        // Update the URL below if your local Fiori launchpad URL is different
        const url = 'http://localhost:4004/v2wa/index.html#Shell-home'; 
        console.log(`Navigating to ${url}...`);
        await page.goto(url);

        console.log("Navigating from Fiori Launchpad to the app...");
        const tile = page.locator('.sapMGT, .sapUshellTile').filter({ hasText: 'Smart Warehouse Allocation' }).first();
        // Fallback if specific classes aren't found, just click the text
        if (await tile.count() === 0) {
            await page.getByText('Smart Warehouse Allocation').first().click();
        } else {
            await tile.click();
        }

        console.log("Waiting for the application to load...");
        // Wait for the "Create Sales Order" button to be visible
        const createBtn = page.getByRole('button', { name: 'Create Order' });
        await createBtn.waitFor({ state: 'visible', timeout: 30000 });
        
        // console.log("Clicking 'Create Sales Order' button...");

        await createBtn.click();

        console.log("Filling the Dialog form...");
        // In UI5, the inner inputs have the class 'sapMInputBaseInner'
        const inputs = page.locator('input.sapMInputBaseInner');
        
        // Wait for dialog to open
        await inputs.nth(0).waitFor({ state: 'visible', timeout: 5000 });

        await inputs.nth(0).fill(customerName);
        await inputs.nth(1).fill(customerEmail);
        await inputs.nth(2).fill(latitude);
        await inputs.nth(3).fill(longitude);

        // Loop through the items and add them
        for (let i = 0; i < items.length; i++) {
            console.log(`Adding Item ${i + 1}...`);
            await page.getByRole('button', { name: 'Add Item' }).click();

            // header has 4 inputs (0,1,2,3). Each item adds 2.
            
            const pIdIndex = 4 + (i * 2);
            const qtyIndex = pIdIndex + 1;

            // Wait for the new item row inputs to be rendered
            await inputs.nth(pIdIndex).waitFor({ state: 'visible', timeout: 5000 });
            
            console.log(`Filling item ${i + 1} details...`);
            await inputs.nth(pIdIndex).fill(items[i].productId);
            
            // Ensure quantity is a valid number string to prevent Playwright errors on type="number" inputs
            let qty = parseFloat(items[i].quantity);
            if (isNaN(qty)) qty = 0; // Default to 0 if an invalid string like "Cod" was entered
            await inputs.nth(qtyIndex).fill(qty.toString());
        }

        console.log("Submitting...");
        
        // Fiori List Report also has a "Create" button (strict mode violation fix).
        // By scoping to the dialog (.sapMDialog), we ensure we only target the dialog's Create button.


        const dialog = page.locator('.sapMDialog');
        await dialog.getByRole('button', { name: 'Create', exact: true }).click();
        
        console.log("Waiting for success message...");
        // Fiori Elements uses MessageToast which has the class .sapMMessageToast


        await page.waitForSelector('.sapMMessageToast:has-text("Sales Order created successfully.")', { timeout: 10000 });
        
        console.log("Success! Sales Order was created as an active record.");
        
        // Leave the browser open for a few seconds to observe the result
        await page.waitForTimeout(3000);
        await browser.close();

    } catch (error) {
        console.error("An error occurred during Playwright execution:", error);
        process.exit(1);
    }
})();
*/

const { test, expect } = require('@playwright/test');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');


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

test('Create Sales Order automated via ods', async ({ page }) => {
    test.setTimeout(120000);

    // Playwright test workers run in detached processes without direct TTY access, 
    // which causes process.stdin and readline to hang indefinitely.
    // Therefore, we pass the ID via an environment variable instead.
    // (Defaults to '1' if not provided so it automatically runs the warehouse logic)


    const id = process.env.ORDER_ID || '1';
    console.log(`Using Id: ${id}`);
    
    let customerName = "ritin";
    let customerEmail = "ritin@example.com";
    let latitude = "70.0";
    let longitude = "-18.0";
    let items = [];

    if (id.trim() === '1') {
        console.log("Id 1 received. Processing warehouse inventory...");
        const csvPath = path.join(__dirname, 'db', 'data', 'swa-WarehouseInventory.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        
        const uniqueProducts = new Map();
        for (let i = 1; i <= 3; i++) {
            const cols = lines[i].split(';');
            if (cols.length >= 3) {
                const productId = cols[1];
                const stockQty = cols[2];
                if (!uniqueProducts.has(productId)) {
                    uniqueProducts.set(productId, stockQty - 6);
                }
            }
        }
        
          const sheetData = [["ProductId", "Quantity"]];
        for (const [prodId, qty] of uniqueProducts.entries()) {
            sheetData.push([prodId, qty]);
        }
        
       
        
        
        
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(sheetData);
        xlsx.utils.book_append_sheet(wb, ws, "Items");
        const odsPath = path.join(__dirname, 'Items.ods');
        xlsx.writeFile(wb, odsPath, { bookType: "ods" });
        console.log(`Saved unique items to ${odsPath}`);
        
        const readWb = xlsx.readFile(odsPath);
        const readWs = readWb.Sheets[readWb.SheetNames[0]];
        const readData = xlsx.utils.sheet_to_json(readWs);
        
        items = readData.map(row => ({
            productId: row.ProductId,
            quantity: row.Quantity
        }));
    } else {
        console.log(`Id ${id} received, fetching last 2 items from CSV.`);
        const csvPath = path.join(__dirname, 'db', 'data', 'swa-WarehouseInventory.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        
        // Exclude header row and grab the last 2 lines
        const lastTwoLines = lines.slice(1).slice(-2);
        const sheetData = [["ProductId", "Quantity"]];
        
        for (const line of lastTwoLines) {
            const cols = line.split(';');
            if (cols.length >= 3) {
                const productId = cols[1];
                // Try to use stock - 6, default to 10 if invalid
                const stockQty = parseInt(cols[2], 10);
                const quantity = isNaN(stockQty) ? "10" : (stockQty - 6).toString();
                sheetData.push([productId, quantity]);
            }
        }

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(sheetData);
        xlsx.utils.book_append_sheet(wb, ws, "Items");
        const odsPath = path.join(__dirname, 'Items.ods');
        xlsx.writeFile(wb, odsPath, { bookType: "ods" });
        console.log(`Saved last 2 items to ${odsPath}`);

        items = sheetData.slice(1).map(row => ({
            productId: row[0],
            quantity: row[1]
        }));
    }
    
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
