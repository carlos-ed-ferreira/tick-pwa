'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BottomSheet, IconButton } from '@/components/ui';
import type { DayItemPreview } from '@/features/calendar/use-month-day-previews';
import type { DailyEntry, LocalDateString } from '@/lib/domain';
import type { CalendarDay } from '@/lib/time';
import { useAppContext } from '@/providers';
import { CalendarMonthGrid } from './calendar-month-grid';

export function CalendarMonthSheet({
  activeDay,
  categoryTagMap,
  dayPreviews,
  entryMap,
  monthGrid,
  open,
  periodLabel,
  todayKey,
  onClose,
  onSelectDay,
  onSelectMonthOffset,
}: {
  activeDay: LocalDateString;
  categoryTagMap: Map<string, { colorHex: string }>;
  dayPreviews: Map<LocalDateString, DayItemPreview>;
  entryMap: Map<LocalDateString, DailyEntry>;
  monthGrid: CalendarDay[];
  open: boolean;
  periodLabel: string;
  todayKey: LocalDateString;
  onClose: () => void;
  onSelectDay: (date: LocalDateString) => void;
  onSelectMonthOffset: (monthOffset: number) => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <BottomSheet
      closeLabel={dictionary.actions.cancel}
      open={open}
      title={dictionary.calendar.monthGridTitle}
      onClose={onClose}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <IconButton
          aria-label={dictionary.calendar.previousMonth}
          className="size-9 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
          onClick={() => onSelectMonthOffset(-1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </IconButton>
        <span className="min-w-0 truncate text-sm font-semibold text-[#fff9f2]">
          {periodLabel}
        </span>
        <IconButton
          aria-label={dictionary.calendar.nextMonth}
          className="size-9 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
          onClick={() => onSelectMonthOffset(1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
      <div className="calendar-shell flex flex-col overflow-hidden">
        <CalendarMonthGrid
          activeDay={activeDay}
          categoryTagMap={categoryTagMap}
          dayPreviews={dayPreviews}
          entryMap={entryMap}
          monthGrid={monthGrid}
          opensOnSingleTap={false}
          todayKey={todayKey}
          onOpenDay={onSelectDay}
          onSelectDay={onSelectDay}
        />
      </div>
    </BottomSheet>
  );
}
