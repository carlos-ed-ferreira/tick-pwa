import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3101';
const fakeAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.signature';

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  outputDir: '.next/playwright-account-results',
  projects: [
    {
      name: 'account-chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'account-mobile-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  reporter: 'list',
  testDir: './tests/e2e',
  testMatch: 'account-latency.spec.ts',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL,
    locale: 'en-US',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `NEXT_PUBLIC_TICK_DISABLE_SUPABASE= NEXT_PUBLIC_TICK_SUPABASE_ENV=local NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=${fakeAnonKey} npm run build && NEXT_PUBLIC_TICK_DISABLE_SUPABASE= NEXT_PUBLIC_TICK_SUPABASE_ENV=local NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=${fakeAnonKey} npm run start -- --hostname 127.0.0.1 --port 3101`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
});
