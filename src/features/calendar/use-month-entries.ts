'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, DailyEntry, LocalDateString } from '@/lib/domain';
import { db } from '@/lib/db';
import { getMonthRange } from '@/lib/time';

export function useMonthEntries(
  scope: AppScope | null,
  monthDate: LocalDateString,
): DailyEntry[] {
  return (
    useLiveQuery(
      async () => {
        if (!scope) {
          return [];
        }

        const { startDate, endDate } = getMonthRange(monthDate);

        return db.dailyEntries
          .where('[scopeId+date]')
          .between([scope.id, startDate], [scope.id, endDate], true, true)
          .filter((entry) => entry.deletedAt === null)
          .toArray();
      },
      [scope?.id, monthDate],
      [],
    ) ?? []
  );
}
