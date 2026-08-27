'use client';

import { useSyncExternalStore } from 'react';

export const coarsePointerQuery = '(pointer: coarse)';

function getMediaQueryList(): MediaQueryList | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  return window.matchMedia(coarsePointerQuery);
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

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
