'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useDebouncedInlineEdit({
  delayMs = 500,
  enabled = true,
  onSave,
  value,
}: {
  delayMs?: number;
  enabled?: boolean;
  onSave: (value: string) => Promise<void> | void;
  value: string;
}) {
  const [draftState, setDraftState] = useState({
    sourceValue: value,
    text: value,
  });
  const timeoutRef = useRef<number | null>(null);
  const text = draftState.sourceValue === value ? draftState.text : value;

  const clearPendingSave = useCallback(() => {
    if (timeoutRef.current === null) {
      return;
    }

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const setText = useCallback(
    (nextText: string) => {
      setDraftState({ sourceValue: value, text: nextText });
    },
    [value],
  );

  const flush = useCallback(async () => {
    clearPendingSave();

    if (!enabled || text === value) {
      return;
    }

    await onSave(text);
  }, [clearPendingSave, enabled, onSave, text, value]);

  useEffect(() => {
    clearPendingSave();

    if (!enabled || text === value) {
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void onSave(text);
    }, delayMs);

    return clearPendingSave;
  }, [clearPendingSave, delayMs, enabled, onSave, text, value]);

  return { flush, setText, text };
}
