'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, Recurrence, RecurrenceResponse } from '@/lib/domain';
import { db } from '@/lib/db';

export function useRecurrences(
  scope: AppScope | null,
): Recurrence[] | undefined {
  return useLiveQuery(
    () =>
      scope
        ? db.recurrences
            .where('scopeId')
            .equals(scope.id)
            .filter((recurrence) => recurrence.deletedAt === null)
            .toArray()
        : [],
    [scope?.id],
  );
}

export function useRecurrenceResponses(
  scope: AppScope | null,
): RecurrenceResponse[] | undefined {
  return useLiveQuery(
    () =>
      scope
        ? db.recurrenceResponses
            .where('scopeId')
            .equals(scope.id)
            .filter((response) => response.deletedAt === null)
            .toArray()
        : [],
    [scope?.id],
  );
}
