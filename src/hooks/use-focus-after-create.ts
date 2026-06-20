'use client';

import { useCallback } from 'react';

export function useFocusAfterCreate({
  getSelector = (itemId: string) => `[data-item-id="${itemId}"]`,
  timeoutMs = 10_000,
}: {
  getSelector?: (itemId: string) => string;
  timeoutMs?: number;
} = {}) {
  return useCallback(
    (itemId: string) => {
      const focusInput = () => {
        const input = document.querySelector<HTMLInputElement>(
          getSelector(itemId),
        );

        if (!input) {
          return false;
        }

        window.requestAnimationFrame(() => {
          input.focus();
          const caretPosition = input.value.length;
          input.setSelectionRange(caretPosition, caretPosition);
        });
        return true;
      };

      if (focusInput()) {
        return;
      }

      const observer = new MutationObserver(() => {
        if (focusInput()) {
          observer.disconnect();
          window.clearTimeout(timeout);
        }
      });
      const timeout = window.setTimeout(() => observer.disconnect(), timeoutMs);

      observer.observe(document.body, { childList: true, subtree: true });
    },
    [getSelector, timeoutMs],
  );
}
