'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { getLocalPreference, setLocalPreference } from '@/lib/db';
import type { AppScope, LocalDateString } from '@/lib/domain';
import { isLocalDateString } from '@/lib/time';

export const CALENDAR_SELECTED_DAY_PREFERENCE_KEY = 'calendarSelectedDay';

function normalizeCalendarDay(value: unknown): LocalDateString | null {
  return typeof value === 'string' && isLocalDateString(value) ? value : null;
}

export function useCalendarSelectedDay(
  scope: AppScope | null,
  todayKey: LocalDateString,
) {
  const scopeId = scope?.id ?? null;
  const storedDay = useLiveQuery(
    () =>
      scope
        ? getLocalPreference<unknown>(
            CALENDAR_SELECTED_DAY_PREFERENCE_KEY,
            scope,
          )
        : Promise.resolve(null),
    [scopeId],
    null,
  );
  const [pickedDay, setPickedDay] = useState<{
    day: LocalDateString;
    scopeId: string | null;
  } | null>(null);
  const selectedDay =
    pickedDay?.scopeId === scopeId
      ? pickedDay.day
      : (normalizeCalendarDay(storedDay) ?? todayKey);

  const selectPersistedDay = useCallback(
    (nextDay: LocalDateString) => {
      setPickedDay({ day: nextDay, scopeId });

      if (!scope) {
        return;
      }

      void setLocalPreference(
        CALENDAR_SELECTED_DAY_PREFERENCE_KEY,
        nextDay,
        scope,
      ).catch((error: unknown) => {
        console.error('Failed to persist the calendar selected day.', error);
      });
    },
    [scope, scopeId],
  );

  return { selectPersistedDay, selectedDay };
}
