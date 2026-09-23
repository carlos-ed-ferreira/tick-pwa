'use client';

import { useSyncExternalStore } from 'react';

export const touchCompositionQuery =
  '(pointer: coarse) and (max-width: 899.98px)';

function getMediaQueryList(): MediaQueryList | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  return window.matchMedia(touchCompositionQuery);
}

function subscribe(onStoreChange: () => void) {
  const mediaQueryList = getMediaQueryList();

  if (!mediaQueryList) {
    return () => {};
  }

  mediaQueryList.addEventListener('change', onStoreChange);

  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return getMediaQueryList()?.matches ?? false;
}

function getServerSnapshot() {
  return false;
}

export function useTouchComposition(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
