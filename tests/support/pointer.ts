import { vi } from 'vitest';

export function stubPointerCapability(
  isCoarse: boolean,
  { isNarrow = isCoarse }: { isNarrow?: boolean } = {},
) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width') ? isCoarse && isNarrow : isCoarse,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}
