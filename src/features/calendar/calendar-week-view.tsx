'use client';

import type { DayItemPreview } from '@/features/calendar/use-month-day-previews';
import { DayDetail } from '@/features/day-editor';
import type { DailyEntry, LocalDateString } from '@/lib/domain';
import { addLocalDays, createWeekGrid } from '@/lib/time';
import { CalendarWeekStrip } from './calendar-week-strip';

export function CalendarWeekView({
  activeDay,
  categoryTagMap,
  dayPreviews,
  entryMap,
  todayKey,
  visibleMonth,
  onSelectDay,
}: {
  activeDay: LocalDateString;
  categoryTagMap: Map<string, { colorHex: string }>;
  dayPreviews: Map<LocalDateString, DayItemPreview>;
  entryMap: Map<LocalDateString, DailyEntry>;
  todayKey: LocalDateString;
  visibleMonth: LocalDateString;
  onSelectDay: (date: LocalDateString) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CalendarWeekStrip
        activeDay={activeDay}
        categoryTagMap={categoryTagMap}
        dayPreviews={dayPreviews}
        entryMap={entryMap}
        todayKey={todayKey}
        week={createWeekGrid(activeDay, visibleMonth)}
        onSelectDay={onSelectDay}
        onShiftWeek={(weekOffset) =>
          onSelectDay(addLocalDays(activeDay, weekOffset * 7))
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <DayDetail date={activeDay} showBackAction={false} />
      </div>
    </div>
  );
}
