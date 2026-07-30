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
  const pendingTextRef = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  const text = draftState.sourceValue === value ? draftState.text : value;

  useEffect(() => {
    onSaveRef.current = onSave;
    enabledRef.current = enabled;
  }, [enabled, onSave]);

  const clearPendingSave = useCallback(() => {
    if (timeoutRef.current === null) {
      return;
    }

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const setText = useCallback(
    (nextText: string) => {
      pendingTextRef.current = enabled && nextText !== value ? nextText : null;
      setDraftState({ sourceValue: value, text: nextText });
    },
    [enabled, value],
  );

  const reset = useCallback(() => {
    clearPendingSave();
    pendingTextRef.current = null;
    setDraftState({ sourceValue: value, text: value });
  }, [clearPendingSave, value]);

  const savePendingText = useCallback(async () => {
    clearPendingSave();
    const pendingText = pendingTextRef.current;

    if (!enabledRef.current || pendingText === null) {
      return;
    }

    pendingTextRef.current = null;

    try {
      await onSaveRef.current(pendingText);
    } catch (error) {
      pendingTextRef.current = pendingText;
      throw error;
    }
  }, [clearPendingSave]);

  const flush = useCallback(async () => {
    await savePendingText();
  }, [savePendingText]);

  useEffect(() => {
    clearPendingSave();

    if (!enabled || text === value) {
      pendingTextRef.current = null;
      return;
    }

    pendingTextRef.current = text;
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void savePendingText();
    }, delayMs);

    return clearPendingSave;
  }, [clearPendingSave, delayMs, enabled, savePendingText, text, value]);

  useEffect(
    () => () => {
      clearPendingSave();

      if (enabledRef.current && pendingTextRef.current !== null) {
        void savePendingText();
      }
    },
    [clearPendingSave, savePendingText],
  );

  return { flush, reset, setText, text };
}
