'use client';

import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';
import { ChecklistSurface } from '@/features/checklist';
import { CalendarTaskTransferAction } from '@/features/calendar/calendar-task-transfer-action';
import {
  duplicateChecklistItemsToDate,
  moveChecklistItemsToDate,
} from '@/lib/db';
import type { LocalDateString } from '@/lib/domain';
import { formatLocalDateLabel } from '@/lib/i18n';
import { parseLocalDateKey } from '@/lib/time';
import { useAppContext } from '@/providers';
import { useDayEntry } from './use-day-entry';

function createDateLabelDate(date: LocalDateString): Date {
  const parsedDate = parseLocalDateKey(date);

  return new Date(
    Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
      12,
    ),
  );
}

export function DayDetail({
  date,
  onBack,
}: {
  date: LocalDateString;
  onBack: () => void;
}) {
  const { dictionary, locale, scope, timezonePreference } = useAppContext();
  const entry = useDayEntry({
    scope,
    date,
    timezone: timezonePreference.timezone,
  });
  const title = formatLocalDateLabel(
    createDateLabelDate(date),
    locale,
    timezonePreference.timezone,
  );
  const handleDuplicateDay = useCallback(
    async (targetDate: LocalDateString) => {
      if (!entry || !scope) {
        return;
      }

      await duplicateChecklistItemsToDate({
        scope,
        sourceDailyEntryId: entry.id,
        targetDate,
        timezone: timezonePreference.timezone,
      });
    },
    [entry, scope, timezonePreference.timezone],
  );
  const handleMoveDay = useCallback(
    async (targetDate: LocalDateString) => {
      if (!entry || !scope) {
        return;
      }

      await moveChecklistItemsToDate({
        scope,
        sourceDailyEntryId: entry.id,
        targetDate,
        timezone: timezonePreference.timezone,
      });
    },
    [entry, scope, timezonePreference.timezone],
  );

  return (
    <section className="grid gap-5 pt-4 sm:pt-5 lg:pt-6">
      <header className="flex flex-col gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2 sm:px-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          <h2 className="min-w-0 truncate text-2xl font-semibold">{title}</h2>
          {entry ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <CalendarTaskTransferAction
                sourceDate={date}
                onDuplicateToDate={handleDuplicateDay}
                onMoveToDate={handleMoveDay}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#312c51]/10 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {dictionary.dayEditor.backToCalendar}
        </button>
      </header>

      <section
        aria-label={title}
        className="flex min-h-0 flex-col rounded-[1.25rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(8,6,20,0.16)] ring-1 ring-white/[0.07] sm:p-4"
      >
        {entry ? (
          <ChecklistSurface dailyEntryId={entry.id} />
        ) : (
          <div className="flex min-h-36 items-center justify-center text-sm text-[#bdb4d4]">
            {dictionary.dayEditor.title}
          </div>
        )}
      </section>
    </section>
  );
}
