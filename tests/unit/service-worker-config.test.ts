import { beforeEach, describe, expect, it, vi } from 'vitest';

const serwistMocks = vi.hoisted(() => ({
  addEventListeners: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock('serwist', () => {
  class Strategy {
    constructor(options?: unknown) {
      void options;
    }
  }

  return {
    CacheFirst: Strategy,
    ExpirationPlugin: Strategy,
    NetworkFirst: Strategy,
    NetworkOnly: Strategy,
    Serwist: class {
      addEventListeners = serwistMocks.addEventListeners;

      constructor(options: unknown) {
        serwistMocks.constructor(options);
      }
    },
    StaleWhileRevalidate: Strategy,
  };
});

describe('service worker lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    serwistMocks.addEventListeners.mockClear();
    serwistMocks.constructor.mockClear();
    vi.stubGlobal('self', { __SW_MANIFEST: [] });
  });

  it('activates an updated worker immediately without clearing local data', async () => {
    await import('@/app/sw');

    expect(serwistMocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        clientsClaim: true,
        navigationPreload: true,
        skipWaiting: true,
      }),
    );
    expect(serwistMocks.addEventListeners).toHaveBeenCalledOnce();
  });
});
