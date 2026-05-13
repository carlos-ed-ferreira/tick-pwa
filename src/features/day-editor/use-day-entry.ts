'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import type { AppScope, DailyEntry, LocalDateString } from '@/lib/domain';
import { db, openOrCreateDailyEntry } from '@/lib/db';

export function useDayEntry({
  scope,
  date,
  timezone,
}: {
  scope: AppScope | null;
  date: LocalDateString | null;
  timezone: string;
}): DailyEntry | null {
  useEffect(() => {
    if (!scope || !date) {
      return;
    }

    void openOrCreateDailyEntry({ scope, date, timezone });
  }, [date, scope, timezone]);

  return (
    useLiveQuery(
      async () => {
        if (!scope || !date) {
          return null;
        }

        const entry = await db.dailyEntries
          .where('[scopeId+date]')
          .equals([scope.id, date])
          .first();

        return entry && entry.deletedAt === null ? entry : null;
      },
      [scope?.id, date],
      null,
    ) ?? null
  );
}
