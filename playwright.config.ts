import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4200',
    browserName: 'chromium',
    launchOptions: {
      executablePath:
        process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] ??
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm start -- --host 0.0.0.0',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
  },
});
