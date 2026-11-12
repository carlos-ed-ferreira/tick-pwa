'use client';

import { filledPillControlClassName } from '@/components/ui';
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
    <div className="flex shrink-0 flex-wrap items-center gap-2 touch:w-full touch:shrink touch:justify-between">
      <CalendarTaskTransferAction
        sourceDate={date}
        onDuplicateToDate={onDuplicateToDate}
        onMoveToDate={onMoveToDate}
      />
      <CategoryManagerAction
        className={`${filledPillControlClassName} touch:ml-auto`}
        surface="checklist_item"
        title={dictionary.calendar.editCategories}
      />
    </div>
  );
}
