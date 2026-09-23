import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  touchCompositionQuery,
  useTouchComposition,
} from '@/hooks/use-touch-composition';

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

describe('useTouchComposition', () => {
  it('pairs the coarse pointer with a handheld width', () => {
    expect(touchCompositionQuery).toContain('pointer: coarse');
    expect(touchCompositionQuery).toContain('max-width');
  });

  it('reports false when the environment has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useTouchComposition());

    expect(result.current).toBe(false);
  });

  it('queries the touch composition media feature', () => {
    const media = stubMatchMedia(true);

    const { result } = renderHook(() => useTouchComposition());

    expect(media.queries).toContain(touchCompositionQuery);
    expect(result.current).toBe(true);
  });

  it('reacts when the viewport stops matching', () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useTouchComposition());

    expect(result.current).toBe(true);

    act(() => media.emit(false));

    expect(result.current).toBe(false);
  });

  it('removes the listener on unmount', () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useTouchComposition());

    expect(media.listenerCount).toBe(1);

    unmount();

    expect(media.listenerCount).toBe(0);
  });
});
