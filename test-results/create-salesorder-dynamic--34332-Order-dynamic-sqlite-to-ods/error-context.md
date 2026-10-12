# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-salesorder-dynamic-sqlite.spec.js >> Create Sales Order dynamic sqlite to ods
- Location: create-salesorder-dynamic-sqlite.spec.js:31:1

# Error details

```
Error: page.waitForSelector: Target page, context or browser has been closed
Call log:
  - waiting for locator('.sapMMessageToast:has-text("Sales Order created successfully.")') to be visible

```

# Test source

```ts
  63  |                     resolve(rows);
  64  |                 }
  65  |             });
  66  |         });
  67  |     };
  68  | 
  69  |     const dbRows = await fetchItems();
  70  |     if (dbRows.length === 0) {
  71  |         throw new Error("No items found in the database for the given offset.");
  72  |     }
  73  |     
  74  |     // 2. Modify quantities and prepare data for ODS
  75  |     const sheetData = [["ProductId", "Quantity"]];
  76  |     for (const row of dbRows) {
  77  |         const originalQty = row.StockQuantity || 0;
  78  |         let newQty = 0;
  79  |         
  80  |         if (originalQty > 1) {
  81  |             // Subtract a random number that is less than originalQty
  82  |             // Let randomSub be in range [1, originalQty - 1]
  83  |             const randomSub = Math.floor(Math.random() * (originalQty - 1)) + 1;
  84  |             newQty = originalQty - randomSub;
  85  |             console.log(`ProductId ${row.ProductId}: Original stock was ${originalQty}, subtracted ${randomSub}, new quantity is ${newQty}`);
  86  |         } else if (originalQty === 1) {
  87  |             newQty = 1;
  88  |             console.log(`ProductId ${row.ProductId}: Original stock was 1, keeping quantity as 1 (cannot subtract random > 0)`);
  89  |         } else {
  90  |             console.log(`ProductId ${row.ProductId}: Original stock was 0, keeping quantity as 0`);
  91  |         }
  92  |         
  93  |         sheetData.push([row.ProductId, newQty]);
  94  |     }
  95  | 
  96  |     // 3. Dynamically write to ODS file
  97  |     const odsPath = path.join(__dirname, 'DynamicItems.ods');
  98  |     const wb = xlsx.utils.book_new();
  99  |     const ws = xlsx.utils.aoa_to_sheet(sheetData);
  100 |     xlsx.utils.book_append_sheet(wb, ws, "Items");
  101 |     xlsx.writeFile(wb, odsPath, { bookType: "ods" });
  102 |     console.log(`Dynamically generated ODS file at ${odsPath}`);
  103 | 
  104 |     // 4. Read the items back from the ODS file
  105 |     const readWb = xlsx.readFile(odsPath);
  106 |     const readWs = readWb.Sheets[readWb.SheetNames[0]];
  107 |     const readData = xlsx.utils.sheet_to_json(readWs);
  108 | 
  109 |     items = readData.map(row => ({
  110 |         productId: row.ProductId,
  111 |         quantity: row.Quantity
  112 |     }));
  113 |     
  114 |     console.log("Items read from ODS to be ordered:", items);
  115 | 
  116 | 
  117 | 
  118 | 
  119 | 
  120 |     
  121 |     // Sales Order via UI
  122 |     console.log("\nNavigating to app...");
  123 |     const url = process.env.APP_URL || 'http://127.0.0.1:4004/v2wa/index.html#Shell-home';
  124 |     await gotoApp(page, url);
  125 | 
  126 |     if (page.url().includes('#Shell-home')) {
  127 |         console.log("On Fiori Launchpad, clicking the app tile...");
  128 |         const tile = page.getByText('Smart Warehouse Allocation').first();
  129 |         await tile.waitFor({ state: 'visible', timeout: 30000 });
  130 |         await tile.click();
  131 |     }
  132 | 
  133 |     const createBtn = page.getByRole('button', { name: 'Create Order' });
  134 |     await createBtn.waitFor({ state: 'visible', timeout: 30000 });
  135 |     await createBtn.click();
  136 | 
  137 |     const inputs = page.locator('input.sapMInputBaseInner');
  138 |     await inputs.nth(0).waitFor({ state: 'visible', timeout: 5000 });
  139 | 
  140 |     await inputs.nth(0).fill(customerName);
  141 |     await inputs.nth(1).fill(customerEmail);
  142 |     await inputs.nth(2).fill(latitude);
  143 |     await inputs.nth(3).fill(longitude);
  144 | 
  145 |     for (let i = 0; i < items.length; i++) {
  146 |         await page.getByRole('button', { name: 'Add Item' }).click();
  147 |         
  148 |         const pIdIndex = 4 + (i * 2);
  149 |         const qtyIndex = pIdIndex + 1;
  150 | 
  151 |         await inputs.nth(pIdIndex).waitFor({ state: 'visible', timeout: 5000 });
  152 |         
  153 |         await inputs.nth(pIdIndex).fill(items[i].productId.toString());
  154 |         
  155 |         let qty = parseFloat(items[i].quantity);
  156 |         if (isNaN(qty)) qty = 0;
  157 |         await inputs.nth(qtyIndex).fill(qty.toString());
  158 |     }
  159 | 
  160 |     const dialog = page.locator('.sapMDialog');
  161 |     await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  162 |     
> 163 |     await page.waitForSelector('.sapMMessageToast:has-text("Sales Order created successfully.")', { timeout: 10000 });
      |                ^ Error: page.waitForSelector: Target page, context or browser has been closed
  164 |     console.log("Success! Sales Order was created.");
  165 |     await page.waitForTimeout(3000);
  166 | });
  167 | 
```