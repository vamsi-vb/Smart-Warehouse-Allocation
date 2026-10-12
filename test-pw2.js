const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ 
      headless: true, 
      args: ['--no-proxy-server'] 
  });
  const context = await browser.newContext({
      httpCredentials: {
          username: 'alice',
          password: '123'
      }
  });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4004/v2wa/index.html#Shell-home');
    console.log("Success");
  } catch(e) {
    console.log("Error:", e);
  }
  await browser.close();
})();
