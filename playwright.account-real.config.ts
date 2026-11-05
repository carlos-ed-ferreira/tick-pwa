import { defineConfig, devices } from '@playwright/test';

const apiUrl = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid',
);
if (
  process.env.TICK_ISOLATED_ACCOUNT_TEST !== '1' ||
  apiUrl.hostname !== '127.0.0.1' ||
  apiUrl.port !== '56321'
) {
  throw new Error('Real account browser tests require the isolated local API.');
}

export default defineConfig({
  testDir: './tests/e2e-account-real',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: '.next/playwright-account-real-results',
  reporter: 'list',
  projects: [
    { name: 'account-real-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:3102',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'make build && make start args="-- --hostname 127.0.0.1 --port 3102"',
    url: 'http://127.0.0.1:3102',
    timeout: 180000,
    reuseExistingServer: false,
  },
});
