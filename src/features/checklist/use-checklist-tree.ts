'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db';
import {
  buildVisibleChecklistRows,
  type VisibleChecklistRow,
} from './checklist-tree';

export function useChecklistTree(
  scope: AppScope | null,
  dailyEntryId: string | null,
): VisibleChecklistRow[] {
  const items = useLiveQuery(
    async () => {
      if (!scope || !dailyEntryId) {
        return [];
      }

      return db.checklistItems
        .where('[scopeId+dailyEntryId]')
        .equals([scope.id, dailyEntryId])
        .filter((item) => item.deletedAt === null)
        .toArray();
    },
    [scope?.id, dailyEntryId],
    [],
  );

  return useMemo(() => buildVisibleChecklistRows(items ?? []), [items]);
}
