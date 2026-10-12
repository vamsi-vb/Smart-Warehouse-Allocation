const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4004/v2wa/index.html');
    console.log("Success");
  } catch(e) {
    console.log("Error:", e);
  }
  await browser.close();
})();
