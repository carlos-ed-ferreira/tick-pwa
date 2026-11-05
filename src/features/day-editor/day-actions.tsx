'use client';

import { CalendarTaskTransferAction } from '@/features/calendar/calendar-task-transfer-action';
import { CategoryManagerAction } from '@/features/categories';
import type { LocalDateString } from '@/lib/domain';
import { useAppContext } from '@/providers';

export function DayActions({
  date,
  onDuplicateToDate,
  onMoveToDate,
}: {
  date: LocalDateString;
  onDuplicateToDate: (targetDate: LocalDateString) => Promise<void>;
  onMoveToDate: (targetDate: LocalDateString) => Promise<void>;
}) {
  const { dictionary } = useAppContext();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <CalendarTaskTransferAction
        sourceDate={date}
        onDuplicateToDate={onDuplicateToDate}
        onMoveToDate={onMoveToDate}
      />
      <CategoryManagerAction
        surface="checklist_item"
        title={dictionary.calendar.editCategories}
      />
    </div>
  );
}
