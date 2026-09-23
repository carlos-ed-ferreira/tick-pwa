import { afterEach, describe, expect, it, vi } from 'vitest';

const originalReuse = process.env.TICK_E2E_REUSE_SERVER;
const originalCi = process.env.CI;

async function loadWebServer() {
  vi.resetModules();
  const config = (await import('../../playwright.config')).default;

  return config.webServer as { reuseExistingServer: boolean };
}

describe('end-to-end server policy', () => {
  afterEach(() => {
    if (originalReuse === undefined) {
      delete process.env.TICK_E2E_REUSE_SERVER;
    } else {
      process.env.TICK_E2E_REUSE_SERVER = originalReuse;
    }

    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
  });

  it('rebuilds the application by default so the gate matches the source', async () => {
    delete process.env.TICK_E2E_REUSE_SERVER;
    delete process.env.CI;

    await expect(loadWebServer()).resolves.toMatchObject({
      reuseExistingServer: false,
    });
  });

  it('reuses a running server only when explicitly requested', async () => {
    process.env.TICK_E2E_REUSE_SERVER = '1';
    delete process.env.CI;

    await expect(loadWebServer()).resolves.toMatchObject({
      reuseExistingServer: true,
    });
  });
});
