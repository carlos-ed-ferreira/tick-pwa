'use client';

import { useCallback } from 'react';
import { ChecklistSurface } from '@/features/checklist';
import { CalendarTaskTransferAction } from '@/features/calendar/calendar-task-transfer-action';
import {
  duplicateChecklistItemsToDate,
  moveChecklistItemsToDate,
  reorderChecklistItemsByScheduledTime,
} from '@/lib/db';
import type { LocalDateString } from '@/lib/domain';
import { Button, Dialog } from '@/components/ui';
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

export function DayEditor({
  date,
  onClose,
}: {
  date: LocalDateString | null;
  onClose: () => void;
}) {
  const { dictionary, locale, scope, timezonePreference } = useAppContext();
  const entry = useDayEntry({
    scope,
    date,
    timezone: timezonePreference.timezone,
  });
  const title = date
    ? formatLocalDateLabel(
        createDateLabelDate(date),
        locale,
        timezonePreference.timezone,
      )
    : dictionary.dayEditor.title;
  const handleDuplicateDay = useCallback(
    async (targetDate: LocalDateString) => {
      if (!entry || !date || !scope) {
        return;
      }

      await duplicateChecklistItemsToDate({
        scope,
        sourceDailyEntryId: entry.id,
        targetDate,
        timezone: timezonePreference.timezone,
      });
    },
    [date, entry, scope, timezonePreference.timezone],
  );
  const handleMoveDay = useCallback(
    async (targetDate: LocalDateString) => {
      if (!entry || !date || !scope) {
        return;
      }

      await moveChecklistItemsToDate({
        scope,
        sourceDailyEntryId: entry.id,
        targetDate,
        timezone: timezonePreference.timezone,
      });
    },
    [date, entry, scope, timezonePreference.timezone],
  );

  return (
    <Dialog
      closeLabel={dictionary.dayEditor.close}
      open={Boolean(date)}
      title={title}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
        {entry && date ? (
          <div className="modal-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#fff9f2]">
                {dictionary.calendar.transferDialogTitle}
              </div>
              <div className="text-xs text-[#bdb4d4]">
                {dictionary.calendar.transferDescription}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <CalendarTaskTransferAction
                sourceDate={date}
                onDuplicateToDate={handleDuplicateDay}
                onMoveToDate={handleMoveDay}
              />
              <Button
                className="h-11 shrink-0 rounded-[1rem] border border-[#f0c38e]/[0.22] bg-[#f0c38e]/10 px-3 text-[#f7d7ad] hover:border-[#f0c38e]/[0.36] hover:bg-[#f0c38e]/[0.16] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
                tone="subtle"
                onClick={() =>
                  void (scope
                    ? reorderChecklistItemsByScheduledTime({
                        scope,
                        dailyEntryId: entry.id,
                      })
                    : undefined)
                }
              >
                {dictionary.calendar.sortByTime}
              </Button>
            </div>
          </div>
        ) : null}
        {entry ? (
          <ChecklistSurface dailyEntryId={entry.id} />
        ) : (
          <div className="modal-panel flex min-h-0 flex-1 items-center justify-center text-sm text-[#bdb4d4]">
            {dictionary.dayEditor.title}
          </div>
        )}
      </div>
    </Dialog>
  );
}
