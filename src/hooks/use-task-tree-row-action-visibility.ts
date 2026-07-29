'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import {
  defaultTaskTreeRowActionPreferences,
  type TaskTreeRowActionPlacement,
  type TaskTreeRowActionPreferences,
} from '@/components/app/task-tree-row-action-visibility';
import {
  getScopedPreference,
  setScopedPreference,
} from '@/lib/db/scoped-preferences';
import { TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY } from '@/lib/supabase/account-preferences';
import { useAppContext } from '@/providers';

const placementActions = [
  'add',
  'bold',
  'category',
  'clearCategory',
  'delete',
  'indent',
  'moveDown',
  'moveUp',
  'outdent',
  'priority',
] as const;

function isPlacement(value: unknown): value is TaskTreeRowActionPlacement {
  return value === 'hidden' || value === 'inline' || value === 'menu';
}

function normalizePreferences(
  value: Partial<TaskTreeRowActionPreferences> | null,
): TaskTreeRowActionPreferences {
  const normalized = { ...defaultTaskTreeRowActionPreferences };

  for (const action of placementActions) {
    if (isPlacement(value?.[action])) {
      normalized[action] = value[action];
    }
  }

  normalized.drag =
    typeof value?.drag === 'boolean' ? value.drag : normalized.drag;
  normalized.scheduledTime =
    typeof value?.scheduledTime === 'boolean'
      ? value.scheduledTime
      : normalized.scheduledTime;

  return normalized;
}

export function useTaskTreeRowActionPreferences() {
  const { scope } = useAppContext();
  const storedPreferences = useLiveQuery(
    () =>
      scope
        ? getScopedPreference<Partial<TaskTreeRowActionPreferences>>(
            TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
            scope,
          )
        : Promise.resolve(null),
    [scope?.id],
    null,
  );
  const actionPreferences = useMemo(
    () => normalizePreferences(storedPreferences),
    [storedPreferences],
  );

  const setActionPreferences = useCallback(
    (nextPreferences: TaskTreeRowActionPreferences) => {
      if (!scope) {
        return;
      }

      void setScopedPreference({
        key: TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
        scope,
        value: normalizePreferences(nextPreferences),
      });
    },
    [scope],
  );

  return { actionPreferences, setActionPreferences };
}
