import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: '.next/playwright-results',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: '.next/playwright-report' }],
      ]
    : 'list',
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
    locale: 'en-US',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1 npm run dev -- --hostname 127.0.0.1 --port 3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
