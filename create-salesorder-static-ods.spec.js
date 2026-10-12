const { test, expect } = require('@playwright/test');
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

test('Create Sales Order automated via static ods slice', async ({ page }) => {
    test.setTimeout(120000);

    // Read the env variable (e.g., SLICE_ENV=1 npx playwright test create-salesorder-static-ods.spec.js)
    const envVar = process.env.SLICE_ENV || '1';
    console.log(`Using Environment Variable (SLICE_ENV): ${envVar}`);
    
    let customerName = "Static User";
    let customerEmail = "static@example.com";
    let latitude = "70.0";
    let longitude = "-18.0";
    let items = [];

    // Path to the pre-filled static ODS file
    const odsPath = path.join(__dirname, 'StaticItems.ods');
    
    if (!fs.existsSync(odsPath)) {
        throw new Error(`ODS file not found at ${odsPath}. Please ensure StaticItems.ods exists.`);
    }

    
    const readWb = xlsx.readFile(odsPath);
    const readWs = readWb.Sheets[readWb.SheetNames[0]];
    const readData = xlsx.utils.sheet_to_json(readWs);

    // based on env
    const envNum = parseInt(envVar.trim(), 10);
    const startIdx = (isNaN(envNum) || envNum < 1) ? 0 : (envNum - 1) * 2;
    const endIdx = startIdx + 2;

    console.log(`Environment variable is ${envVar}: Slicing rows from index ${startIdx} to ${endIdx - 1}.`);
    items = readData.slice(startIdx, endIdx);

    items = items.map(row => ({
        productId: row.ProductId,
        quantity: row.Quantity
    }));

    console.log("Items to be processed:", items);

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
