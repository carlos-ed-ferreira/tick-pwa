import { beforeEach, describe, expect, it, vi } from 'vitest';

const serwistMocks = vi.hoisted(() => ({
  withSerwistInit: vi.fn(
    (options: {
      additionalPrecacheEntries: Array<{ revision: string; url: string }>;
    }) => {
      void options;
      return (config: unknown) => config;
    },
  ),
}));

vi.mock('@serwist/next', () => ({
  default: serwistMocks.withSerwistInit,
}));

describe('PWA app shell', () => {
  beforeEach(() => {
    vi.resetModules();
    serwistMocks.withSerwistInit.mockClear();
  });

  it('precaches every route that must support a direct offline reload', async () => {
    await import('../../next.config');

    const options = serwistMocks.withSerwistInit.mock.calls[0][0];
    const urls = options.additionalPrecacheEntries.map(
      (entry: { url: string }) => entry.url,
    );

    expect(urls).toEqual(['/', '/calendar', '/goals', '/~offline']);
  });
});
