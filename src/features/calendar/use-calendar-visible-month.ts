'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { getLocalPreference, setLocalPreference } from '@/lib/db';
import type { AppScope, LocalDateString } from '@/lib/domain';
import {
  createLocalDateKey,
  isLocalDateString,
  parseLocalDateKey,
} from '@/lib/time';

export const CALENDAR_VISIBLE_MONTH_PREFERENCE_KEY = 'calendarVisibleMonth';

function normalizeCalendarMonth(value: unknown): LocalDateString | null {
  if (typeof value !== 'string' || !isLocalDateString(value)) {
    return null;
  }

  const parsedDate = parseLocalDateKey(value);
  const normalizedMonth = createLocalDateKey(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    1,
  );

  return normalizedMonth === value ? value : null;
}

export function useCalendarVisibleMonth(
  scope: AppScope | null,
  currentMonth: LocalDateString,
) {
  const scopeId = scope?.id ?? null;
  const storedMonth = useLiveQuery(
    () =>
      scope
        ? getLocalPreference<unknown>(
            CALENDAR_VISIBLE_MONTH_PREFERENCE_KEY,
            scope,
          )
        : Promise.resolve(null),
    [scopeId],
    null,
  );
  const [selectedMonth, setSelectedMonth] = useState<{
    month: LocalDateString;
    scopeId: string | null;
  } | null>(null);
  const visibleMonth =
    selectedMonth?.scopeId === scopeId
      ? selectedMonth.month
      : (normalizeCalendarMonth(storedMonth) ?? currentMonth);

  const selectVisibleMonth = useCallback(
    (nextMonth: LocalDateString) => {
      setSelectedMonth({ month: nextMonth, scopeId });

      if (!scope) {
        return;
      }

      void setLocalPreference(
        CALENDAR_VISIBLE_MONTH_PREFERENCE_KEY,
        nextMonth,
        scope,
      ).catch((error: unknown) => {
        console.error('Failed to persist the calendar visible month.', error);
      });
    },
    [scope, scopeId],
  );

  return { selectVisibleMonth, visibleMonth };
}
