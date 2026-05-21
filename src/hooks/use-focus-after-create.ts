'use client';

import { useCallback } from 'react';

export function useFocusAfterCreate({
  getSelector = (itemId: string) => `[data-item-id="${itemId}"]`,
  maxRetries = 20,
}: {
  getSelector?: (itemId: string) => string;
  maxRetries?: number;
} = {}) {
  return useCallback(
    (itemId: string) => {
      let retries = 0;

      const tryFocus = () => {
        const input = document.querySelector<HTMLInputElement>(
          getSelector(itemId),
        );

        if (input) {
          input.focus();
          return;
        }

        if (retries >= maxRetries) {
          return;
        }

        retries += 1;
        window.requestAnimationFrame(tryFocus);
      };

      window.requestAnimationFrame(tryFocus);
    },
    [getSelector, maxRetries],
  );
}
