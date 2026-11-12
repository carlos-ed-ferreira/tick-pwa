'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconButton } from '@/components/ui';
import type { DayItemPreview } from '@/features/calendar/use-month-day-previews';
import type { DailyEntry, LocalDateString } from '@/lib/domain';
import { parseLocalDateKey, type CalendarDay } from '@/lib/time';
import { useAppContext } from '@/providers';
import {
  getCalendarWeekDensity,
  getVisibleCategoryLimit,
} from './calendar-day-density';
import {
  getProgressTone,
  ignoredProgressFillStyle,
  isCategoryComplete,
} from './calendar-progress-tone';

function WeekArrowButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <IconButton
      aria-label={label}
      size="compact"
      className="shrink-0 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
      onClick={onClick}
    >
      {children}
    </IconButton>
  );
}

export function CalendarWeekStrip({
  activeDay,
  categoryTagMap,
  dayPreviews,
  entryMap,
  todayKey,
  week,
  onSelectDay,
  onShiftWeek,
}: {
  activeDay: LocalDateString;
  categoryTagMap: Map<string, { colorHex: string }>;
  dayPreviews: Map<LocalDateString, DayItemPreview>;
  entryMap: Map<LocalDateString, DailyEntry>;
  todayKey: LocalDateString;
  week: CalendarDay[];
  onSelectDay: (date: LocalDateString) => void;
  onShiftWeek: (weekOffset: number) => void;
}) {
  const { dictionary } = useAppContext();
  const { stripRef, dayWidth } = useCalendarWeekLayout(activeDay);

  const isCompact = getCalendarWeekDensity(dayWidth) === 'compact';
  const visibleCategoryLimit = getVisibleCategoryLimit(dayWidth);

  return (
    <div className="flex items-center gap-1 px-2 pt-2 pb-1">
      <WeekArrowButton
        label={dictionary.calendar.previousWeek}
        onClick={() => onShiftWeek(-1)}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </WeekArrowButton>
      <div className="min-w-0 flex-1 overflow-x-auto py-1">
        <div
          ref={stripRef}
          role="tablist"
          aria-label={dictionary.calendar.week}
          className="calendar-week-strip relative grid min-w-[20.75rem] grid-cols-7 gap-1"
        >
          {week.map((day, dayIndex) => (
            <WeekDay
              key={day.date}
              categoryTagMap={categoryTagMap}
              date={day.date}
              dayPreview={dayPreviews.get(day.date) ?? null}
              entry={entryMap.get(day.date) ?? null}
              inCurrentMonth={day.inCurrentMonth}
              isCompact={isCompact}
              isSelected={activeDay === day.date}
              isToday={todayKey === day.date}
              visibleCategoryLimit={visibleCategoryLimit}
              weekdayLabel={dictionary.calendar.weekdays[dayIndex]}
              onSelectDay={onSelectDay}
            />
          ))}
        </div>
      </div>
      <WeekArrowButton
        label={dictionary.calendar.nextWeek}
        onClick={() => onShiftWeek(1)}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </WeekArrowButton>
    </div>
  );
}

function useCalendarWeekLayout(activeDay: LocalDateString) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [dayWidth, setDayWidth] = useState(0);

  useLayoutEffect(() => {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    const measureDay = () =>
      setDayWidth(strip.getBoundingClientRect().width / 7);

    measureDay();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureDay);

      return () => window.removeEventListener('resize', measureDay);
    }

    const observer = new ResizeObserver(measureDay);
    observer.observe(strip);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const selected = stripRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    const container = stripRef.current?.parentElement;
    if (
      selected &&
      container &&
      container.scrollWidth > container.clientWidth
    ) {
      const left =
        selected.getBoundingClientRect().left -
        container.getBoundingClientRect().left +
        container.scrollLeft;
      container.scrollTo({
        left: Math.max(
          0,
          left - (container.clientWidth - selected.offsetWidth) / 2,
        ),
      });
    }
  }, [activeDay, dayWidth]);

  return { stripRef, dayWidth };
}

function WeekDay({
  categoryTagMap,
  date,
  dayPreview,
  entry,
  inCurrentMonth,
  isCompact,
  isSelected,
  isToday,
  visibleCategoryLimit,
  weekdayLabel,
  onSelectDay,
}: {
  categoryTagMap: Map<string, { colorHex: string }>;
  date: LocalDateString;
  dayPreview: DayItemPreview | null;
  entry: DailyEntry | null;
  inCurrentMonth: boolean;
  isCompact: boolean;
  isSelected: boolean;
  isToday: boolean;
  visibleCategoryLimit: number;
  weekdayLabel: string;
  onSelectDay: (date: LocalDateString) => void;
}) {
  const completedRatio =
    entry && entry.itemCount > 0 ? entry.completedCount / entry.itemCount : 0;
  const ignoredCount = dayPreview?.ignoredCount ?? 0;
  const categoryTagIds =
    dayPreview?.categoryTagIds ?? entry?.categoryTagIds ?? [];
  const visibleCategoryTagIds =
    categoryTagIds.length > visibleCategoryLimit
      ? categoryTagIds.slice(0, Math.max(1, visibleCategoryLimit - 1))
      : categoryTagIds;
  const categorySummaryMap = new Map(
    (entry?.categorySummaries ?? []).map((summary) => [
      summary.categoryTagId,
      summary,
    ]),
  );
  const progressTone = getProgressTone(completedRatio);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      data-testid="calendar-week-day"
      className={`touch-target flex min-h-16 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
        isSelected
          ? 'inset-ring-hairline inset-ring-[#f3d2aa]/60 bg-[linear-gradient(180deg,rgba(240,195,142,0.18),rgba(255,255,255,0.03))] shadow-[0_10px_24px_rgba(5,8,13,0.22)]'
          : 'bg-white/[0.02] hover:bg-white/[0.055]'
      } ${inCurrentMonth ? '' : 'opacity-55'}`}
      onClick={() => onSelectDay(date)}
    >
      <span className="text-[11px] font-medium uppercase leading-none tracking-wide text-muted">
        {weekdayLabel}
      </span>
      <span
        className={`calendar-day-number ${
          isSelected
            ? 'bg-[#f7e1bc] text-[#253241]'
            : isToday
              ? 'bg-white/10 text-[#f7e1bc] inset-ring-hairline inset-ring-[#f7e1bc]/35'
              : 'bg-transparent text-[#e5ebf3]'
        }`}
      >
        {parseLocalDateKey(date).getDate()}
      </span>
      {entry && entry.itemCount > 0 ? (
        <span
          className="calendar-chip px-1 py-0.5 text-[11px] font-semibold leading-none tabular-nums"
          style={progressTone.badgeStyle}
        >
          {entry.completedCount}/{entry.itemCount}
        </span>
      ) : null}
      <span
        className="flex h-1 w-full overflow-hidden rounded-full bg-white/6"
        data-testid="calendar-week-day-progress"
        style={progressTone.trackStyle}
      >
        {entry && entry.itemCount > 0 ? (
          <span
            className="block min-w-0 basis-0 overflow-hidden"
            style={{ flexGrow: entry.itemCount }}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-200"
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
            data-testid="calendar-week-day-ignored"
            style={{ ...ignoredProgressFillStyle, flexGrow: ignoredCount }}
          />
        ) : null}
      </span>
      {isCompact || visibleCategoryTagIds.length === 0 ? null : (
        <span className="flex items-center justify-center gap-1">
          {visibleCategoryTagIds.map((categoryTagId) => {
            const colorHex = categoryTagMap.get(categoryTagId)?.colorHex;

            return (
              <span
                key={categoryTagId}
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: colorHex,
                  opacity: isCategoryComplete(
                    categorySummaryMap.get(categoryTagId),
                  )
                    ? 1
                    : 0.3,
                }}
              />
            );
          })}
        </span>
      )}
    </button>
  );
}
