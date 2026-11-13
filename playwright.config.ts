import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    channel: 'chromium',
    actionTimeout: 10000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: `node scripts/start.mjs --port ${port}`,
    url: `http://127.0.0.1:${port}/api/v1/health`,
    reuseExistingServer: false,
  },
});
