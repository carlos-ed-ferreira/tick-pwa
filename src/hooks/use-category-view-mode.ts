'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import {
  getScopedPreference,
  setScopedPreference,
} from '@/lib/db/scoped-preferences';
import { getCategoryViewModePreferenceKey } from '@/lib/supabase/account-preferences';
import { useAppContext } from '@/providers';

export type CategoryViewMode = 'list' | 'tabs';

export const defaultCategoryViewMode: CategoryViewMode = 'list';

export function isCategoryViewMode(value: unknown): value is CategoryViewMode {
  return value === 'list' || value === 'tabs';
}

export function useCategoryViewMode(surface: 'checklist_item' | 'goal_step') {
  const { scope } = useAppContext();
  const preferenceKey = getCategoryViewModePreferenceKey(surface);
  const storedViewMode = useLiveQuery(
    () =>
      scope
        ? getScopedPreference<CategoryViewMode>(preferenceKey, scope)
        : Promise.resolve(null),
    [preferenceKey, scope?.id],
    null,
  );
  const viewMode = isCategoryViewMode(storedViewMode)
    ? storedViewMode
    : defaultCategoryViewMode;

  const setViewMode = useCallback(
    (nextViewMode: CategoryViewMode) => {
      if (!scope) {
        return;
      }

      void setScopedPreference({
        key: preferenceKey,
        scope,
        value: nextViewMode,
      });
    },
    [preferenceKey, scope],
  );

  return { setViewMode, viewMode };
}
