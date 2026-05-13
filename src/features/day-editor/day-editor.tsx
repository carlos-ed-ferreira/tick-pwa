'use client';

import { ChecklistSurface } from '@/features/checklist';
import type { LocalDateString } from '@/lib/domain';
import { Dialog } from '@/components/ui';
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

  return (
    <Dialog
      closeLabel={dictionary.dayEditor.close}
      open={Boolean(date)}
      title={title}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
        {entry ? (
          <ChecklistSurface dailyEntryId={entry.id} />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-background/50 text-sm text-muted">
            {dictionary.dayEditor.title}
          </div>
        )}
      </div>
    </Dialog>
  );
}
