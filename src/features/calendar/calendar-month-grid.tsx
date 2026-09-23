'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { DayItemPreview } from '@/features/calendar/use-month-day-previews';
import type { DailyEntry, LocalDateString } from '@/lib/domain';
import { formatCountLabel } from '@/lib/i18n';
import { parseLocalDateKey, type CalendarDay } from '@/lib/time';
import { useAppContext } from '@/providers';
import {
  getCalendarDayDensity,
  getVisibleCategoryLimit,
  type CalendarDayDensity,
} from './calendar-day-density';
import {
  getProgressTone,
  ignoredProgressFillStyle,
  isCategoryComplete,
} from './calendar-progress-tone';

export function CalendarMonthGrid({
  activeDay,
  categoryTagMap,
  dayPreviews,
  entryMap,
  monthGrid,
  opensOnSingleTap,
  todayKey,
  onOpenDay,
  onSelectDay,
}: {
  activeDay: LocalDateString;
  categoryTagMap: Map<string, { colorHex: string }>;
  dayPreviews: Map<LocalDateString, DayItemPreview>;
  entryMap: Map<LocalDateString, DailyEntry>;
  monthGrid: CalendarDay[];
  opensOnSingleTap: boolean;
  todayKey: LocalDateString;
  onOpenDay: (date: LocalDateString) => void;
  onSelectDay: (date: LocalDateString) => void;
}) {
  const { dictionary } = useAppContext();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [dayCellWidth, setDayCellWidth] = useState(0);

  useLayoutEffect(() => {
    const grid = gridRef.current;

    if (!grid) {
      return;
    }

    const measureDayCell = () =>
      setDayCellWidth(grid.getBoundingClientRect().width / 7);

    measureDayCell();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureDayCell);

      return () => window.removeEventListener('resize', measureDayCell);
    }

    const observer = new ResizeObserver(measureDayCell);
    observer.observe(grid);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="grid grid-cols-7 border-y border-white/8 bg-white/4 text-center text-[0.68rem] font-medium uppercase tracking-[0.28em] text-[#aebac8]">
        {dictionary.calendar.weekdays.map((weekday) => (
          <div key={weekday} className="px-2 py-1.5">
            {weekday}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className="calendar-day-grid grid min-h-0 flex-1 grid-cols-7 auto-rows-fr"
      >
        {monthGrid.map((day) => (
          <DayCell
            key={day.date}
            date={day.date}
            density={getCalendarDayDensity(dayCellWidth)}
            entry={entryMap.get(day.date) ?? null}
            categoryTagMap={categoryTagMap}
            dayPreview={dayPreviews.get(day.date) ?? null}
            opensOnSingleTap={opensOnSingleTap}
            visibleCategoryLimit={getVisibleCategoryLimit(dayCellWidth)}
            inCurrentMonth={day.inCurrentMonth}
            isSelected={activeDay === day.date}
            isToday={todayKey === day.date}
            onOpenDay={onOpenDay}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    </>
  );
}

function DayCell({
  date,
  dayPreview,
  density,
  entry,
  categoryTagMap,
  inCurrentMonth,
  isSelected,
  isToday,
  onOpenDay,
  onSelectDay,
  opensOnSingleTap,
  visibleCategoryLimit,
}: {
  date: LocalDateString;
  dayPreview: DayItemPreview | null;
  density: CalendarDayDensity;
  entry: DailyEntry | null;
  categoryTagMap: Map<string, { colorHex: string }>;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onOpenDay: (date: LocalDateString) => void;
  onSelectDay: (date: LocalDateString) => void;
  opensOnSingleTap: boolean;
  visibleCategoryLimit: number;
}) {
  const { dictionary } = useAppContext();
  const parsedDate = parseLocalDateKey(date);
  const completedRatio =
    entry && entry.itemCount > 0 ? entry.completedCount / entry.itemCount : 0;
  const categoryTagIds =
    dayPreview?.categoryTagIds ?? entry?.categoryTagIds ?? [];
  const ignoredCount = dayPreview?.ignoredCount ?? 0;
  const visibleCategoryTagIds =
    categoryTagIds.length > visibleCategoryLimit
      ? categoryTagIds.slice(0, Math.max(1, visibleCategoryLimit - 1))
      : categoryTagIds;
  const hiddenCategoryCount =
    categoryTagIds.length - visibleCategoryTagIds.length;
  const categorySummaryMap = new Map(
    (entry?.categorySummaries ?? []).map((summary) => [
      summary.categoryTagId,
      summary,
    ]),
  );
  const progressTone = getProgressTone(completedRatio);
  const isCompact = density === 'compact';

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={`group calendar-day-cell flex flex-col text-left ${
        inCurrentMonth || isSelected
          ? 'bg-[rgba(255,255,255,0.012)] hover:bg-[rgba(255,255,255,0.045)]'
          : 'bg-transparent text-[#6a7a8b] opacity-40 hover:bg-[rgba(255,255,255,0.03)] hover:opacity-80'
      } ${
        isSelected
          ? 'relative z-10 border-[#f3d2aa]/40 bg-[linear-gradient(180deg,rgba(240,195,142,0.14),rgba(255,255,255,0.025))] shadow-[inset_0_0_0_1px_rgba(243,210,170,0.6),0_0_0_1px_rgba(243,210,170,0.12),0_18px_28px_rgba(5,8,13,0.18)]'
          : 'shadow-none'
      }`}
      onClick={() => {
        if (opensOnSingleTap) {
          onOpenDay(date);
          return;
        }

        onSelectDay(date);
      }}
      onDoubleClick={() => onOpenDay(date)}
    >
      <span
        className={`calendar-day-number ${
          isSelected
            ? 'bg-[#f7e1bc] text-[#253241] shadow-[0_8px_18px_rgba(240,195,142,0.2)]'
            : isToday
              ? 'bg-white/10 text-[#f7e1bc] inset-ring-hairline inset-ring-[#f7e1bc]/35'
              : 'bg-transparent text-inherit'
        }`}
      >
        {parsedDate.getDate()}
      </span>

      <div
        className={`mt-auto flex flex-col ${
          isCompact ? 'gap-1.5 pt-1' : 'gap-2.5 pt-2'
        }`}
      >
        {entry && (entry.itemCount > 0 || ignoredCount > 0) ? (
          <span
            className={`flex flex-col text-xs ${isCompact ? 'gap-1' : 'gap-2'}`}
          >
            <span
              className={
                isCompact
                  ? 'flex flex-col items-start gap-1'
                  : 'flex flex-wrap items-center gap-1.5'
              }
            >
              {entry.itemCount > 0 ? (
                <span
                  className="calendar-chip px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-[#f7e8ce]"
                  style={progressTone.badgeStyle}
                >
                  {entry.completedCount}/{entry.itemCount}
                </span>
              ) : null}
              {ignoredCount > 0 ? (
                <>
                  {!isCompact && entry.itemCount > 0 ? (
                    <span
                      aria-hidden="true"
                      className="text-[10px] text-[#63748a]"
                    >
                      ·
                    </span>
                  ) : null}
                  <span className="text-[10px] font-medium leading-none tabular-nums text-[#8fa0b3]">
                    {formatCountLabel({
                      count: ignoredCount,
                      plural: dictionary.calendar.ignoredItems,
                      singular: dictionary.calendar.ignoredItem,
                    })}
                  </span>
                </>
              ) : null}
            </span>
            <span
              className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/6"
              data-testid="calendar-day-progress-track"
              style={progressTone.trackStyle}
            >
              {entry.itemCount > 0 ? (
                <span
                  className="block min-w-0 basis-0 overflow-hidden"
                  data-testid="calendar-day-progress-counted-segment"
                  style={{ flexGrow: entry.itemCount }}
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-200"
                    data-testid="calendar-day-progress-fill"
                    style={{
                      ...progressTone.fillStyle,
                      width: `${Math.round(completedRatio * 100)}%`,
                    }}
                  />
                </span>
              ) : null}
              {ignoredCount > 0 ? (
                <span
                  className="block min-w-0 basis-0"
                  data-testid="calendar-day-progress-ignored-segment"
                  style={{
                    ...ignoredProgressFillStyle,
                    flexGrow: ignoredCount,
                  }}
                />
              ) : null}
            </span>
          </span>
        ) : null}

        {categoryTagIds.length > 0 ? (
          <span
            className="flex items-center gap-2 pb-0.5"
            data-testid="calendar-day-categories"
          >
            {visibleCategoryTagIds.map((categoryTagId) =>
              (() => {
                const colorHex = categoryTagMap.get(categoryTagId)?.colorHex;
                const completed = isCategoryComplete(
                  categorySummaryMap.get(categoryTagId),
                );

                return (
                  <span
                    key={categoryTagId}
                    className="size-2.5 shrink-0 rounded-full inset-ring-hairline inset-ring-white/35 transition-opacity"
                    style={{
                      backgroundColor: colorHex,
                      opacity: completed ? 1 : 0.28,
                      boxShadow:
                        completed && colorHex
                          ? `0 0 0 1px rgba(255, 255, 255, 0.28), 0 0 10px ${colorHex}33`
                          : 'none',
                    }}
                  />
                );
              })(),
            )}
            {hiddenCategoryCount > 0 ? (
              <span className="text-[10px] font-semibold leading-none text-[#aebac8]">
                +{hiddenCategoryCount}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </button>
  );
}
