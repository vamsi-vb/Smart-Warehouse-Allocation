const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  reporter: 'html',
  timeout: 120000,
  use: {
    launchOptions: {
      args: ['--no-proxy-server'],
    },
  },
  webServer: {
    command: 'cmd /c npm start',
    url: 'http://127.0.0.1:4004/v2wa/index.html',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
