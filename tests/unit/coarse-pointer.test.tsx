import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';

type MediaQueryListener = (event: { matches: boolean }) => void;

function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MediaQueryListener>();
  const queries: string[] = [];
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: (_type: string, listener: MediaQueryListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: MediaQueryListener) => {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      queries.push(query);
      return mediaQueryList;
    }),
  );

  return {
    queries,
    emit(matches: boolean) {
      mediaQueryList.matches = matches;
      for (const listener of listeners) {
        listener({ matches });
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCoarsePointer', () => {
  it('reports false when the environment has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useCoarsePointer());

    expect(result.current).toBe(false);
  });

  it('queries the coarse pointer media feature', () => {
    const media = stubMatchMedia(true);

    const { result } = renderHook(() => useCoarsePointer());

    expect(media.queries).toContain('(pointer: coarse)');
    expect(result.current).toBe(true);
  });

  it('reacts when the pointer capability changes', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useCoarsePointer());

    expect(result.current).toBe(false);

    act(() => media.emit(true));

    expect(result.current).toBe(true);
  });

  it('removes the listener on unmount', () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useCoarsePointer());

    expect(media.listenerCount).toBe(1);

    unmount();

    expect(media.listenerCount).toBe(0);
  });
});
