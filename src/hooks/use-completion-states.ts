'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef } from 'react';
import {
  getScopedPreference,
  setScopedPreference,
} from '@/lib/db/scoped-preferences';
import {
  defaultTaskCompletionSettings,
  normalizeTaskCompletionSettings,
  type TaskCompletionSettings,
} from '@/lib/domain';
import { getCompletionStatesPreferenceKey } from '@/lib/supabase/account-preferences';
import { useAppContext } from '@/providers';

export function useCompletionStates(surface: 'checklist_item' | 'goal_step') {
  const { scope } = useAppContext();
  const preferenceKey = getCompletionStatesPreferenceKey(surface);
  const storedSettings = useLiveQuery(
    () =>
      scope
        ? getScopedPreference<TaskCompletionSettings>(preferenceKey, scope)
        : Promise.resolve(null),
    [preferenceKey, scope?.id],
    null,
  );
  const completionSettings =
    storedSettings === null
      ? defaultTaskCompletionSettings
      : normalizeTaskCompletionSettings(storedSettings);

  const latestSettingsRef = useRef(completionSettings);

  useEffect(() => {
    latestSettingsRef.current = completionSettings;
  }, [completionSettings]);

  const setCompletionSettings = useCallback(
    (
      update:
        | TaskCompletionSettings
        | ((current: TaskCompletionSettings) => TaskCompletionSettings),
    ) => {
      if (!scope) {
        return;
      }

      const nextSettings = normalizeTaskCompletionSettings(
        typeof update === 'function'
          ? update(latestSettingsRef.current)
          : update,
      );
      latestSettingsRef.current = nextSettings;

      void setScopedPreference({
        key: preferenceKey,
        scope,
        value: nextSettings,
      });
    },
    [preferenceKey, scope],
  );

  return { completionSettings, setCompletionSettings };
}
