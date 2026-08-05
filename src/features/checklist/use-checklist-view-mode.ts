'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import {
  getScopedPreference,
  setScopedPreference,
} from '@/lib/db/scoped-preferences';
import { CHECKLIST_VIEW_MODE_PREFERENCE_KEY } from '@/lib/supabase/account-preferences';
import { useAppContext } from '@/providers';

export type ChecklistViewMode = 'list' | 'tabs';

export const defaultChecklistViewMode: ChecklistViewMode = 'list';

export function isChecklistViewMode(
  value: unknown,
): value is ChecklistViewMode {
  return value === 'list' || value === 'tabs';
}

export function useChecklistViewMode() {
  const { scope } = useAppContext();
  const storedViewMode = useLiveQuery(
    () =>
      scope
        ? getScopedPreference<ChecklistViewMode>(
            CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
            scope,
          )
        : Promise.resolve(null),
    [scope?.id],
    null,
  );
  const viewMode = isChecklistViewMode(storedViewMode)
    ? storedViewMode
    : defaultChecklistViewMode;

  const setViewMode = useCallback(
    (nextViewMode: ChecklistViewMode) => {
      if (!scope) {
        return;
      }

      void setScopedPreference({
        key: CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
        scope,
        value: nextViewMode,
      });
    },
    [scope],
  );

  return { setViewMode, viewMode };
}
