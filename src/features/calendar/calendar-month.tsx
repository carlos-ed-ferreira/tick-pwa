'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DayEditor } from '@/features/day-editor';
import { useColorTags } from '@/features/colors';
import type { DailyEntry, LocalDateString } from '@/lib/domain';
import { formatMonthLabel } from '@/lib/i18n';
import {
  createLocalDateKey,
  createMonthGrid,
  getTodayKey,
  isLocalDateString,
  parseLocalDateKey,
} from '@/lib/time';
import { useAppContext } from '@/providers';
import { useMonthEntries } from './use-month-entries';

function createMonthLabelDate(monthDate: LocalDateString): Date {
  const parsedDate = parseLocalDateKey(monthDate);

  return new Date(
    Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), 15, 12),
  );
}

function shiftMonth(
  monthDate: LocalDateString,
  offset: number,
): LocalDateString {
  const parsedDate = parseLocalDateKey(monthDate);

  return createLocalDateKey(
    parsedDate.getFullYear(),
    parsedDate.getMonth() + offset,
    1,
  );
}

function entriesByDate(
  entries: DailyEntry[],
): Map<LocalDateString, DailyEntry> {
  return new Map(entries.map((entry) => [entry.date, entry]));
}

export function CalendarMonth() {
  const { dictionary, locale, scope, timezonePreference } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayKey = getTodayKey(timezonePreference.timezone);
  const dayParam = searchParams.get('day');
  const openDayDate = dayParam && isLocalDateString(dayParam) ? dayParam : null;
  const [visibleMonth, setVisibleMonth] = useState<LocalDateString>(
    () => todayKey,
  );
  const [selectedDay, setSelectedDay] = useState<LocalDateString | null>(
    todayKey,
  );
  const entries = useMonthEntries(scope, visibleMonth);
  const colorTags = useColorTags(scope);
  const entryMap = useMemo(() => entriesByDate(entries), [entries]);
  const colorTagMap = useMemo(
    () => new Map(colorTags.map((tag) => [tag.id, tag])),
    [colorTags],
  );
  const monthGrid = useMemo(
    () => createMonthGrid(visibleMonth),
    [visibleMonth],
  );
  const monthLabel = formatMonthLabel(
    createMonthLabelDate(visibleMonth),
    locale,
    timezonePreference.timezone,
  );
  const closeDay = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete('day');
    const queryString = nextSearchParams.toString();

    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);
  const openDay = useCallback(
    (date: LocalDateString) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('day', date);
      setSelectedDay(date);
      router.replace(`${pathname}?${nextSearchParams.toString()}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
  const selectDay = useCallback((date: LocalDateString) => {
    setSelectedDay(date);
  }, []);

  return (
    <>
      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <CalendarDays aria-hidden="true" className="size-5 text-muted" />
            <h2 className="truncate text-lg font-semibold capitalize">
              {monthLabel}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={dictionary.calendar.previousMonth}
              className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() =>
                setVisibleMonth((currentMonth) => shiftMonth(currentMonth, -1))
              }
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              className="h-10 rounded-md border border-border px-3 text-sm font-medium transition hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() => {
                setVisibleMonth(todayKey);
                setSelectedDay(todayKey);
              }}
            >
              {dictionary.calendar.today}
            </button>
            <button
              type="button"
              aria-label={dictionary.calendar.nextMonth}
              className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() =>
                setVisibleMonth((currentMonth) => shiftMonth(currentMonth, 1))
              }
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b border-border bg-background/60 text-center text-xs font-medium uppercase tracking-wide text-muted">
          {dictionary.calendar.weekdays.map((weekday) => (
            <div key={weekday} className="px-2 py-2">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 auto-rows-fr">
          {monthGrid.map((day) => (
            <DayCell
              key={day.date}
              date={day.date}
              dictionaryEmptyLabel={dictionary.calendar.emptyDay}
              entry={entryMap.get(day.date) ?? null}
              colorTagMap={colorTagMap}
              inCurrentMonth={day.inCurrentMonth}
              isSelected={(openDayDate ?? selectedDay) === day.date}
              isToday={todayKey === day.date}
              onOpenDay={openDay}
              onSelectDay={selectDay}
            />
          ))}
        </div>
      </section>
      <DayEditor date={openDayDate} onClose={closeDay} />
    </>
  );
}

function DayCell({
  date,
  dictionaryEmptyLabel,
  entry,
  colorTagMap,
  inCurrentMonth,
  isSelected,
  isToday,
  onOpenDay,
  onSelectDay,
}: {
  date: LocalDateString;
  dictionaryEmptyLabel: string;
  entry: DailyEntry | null;
  colorTagMap: Map<string, { hex: string }>;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onOpenDay: (date: LocalDateString) => void;
  onSelectDay: (date: LocalDateString) => void;
}) {
  const parsedDate = parseLocalDateKey(date);
  const completedRatio =
    entry && entry.itemCount > 0 ? entry.completedCount / entry.itemCount : 0;
  const colorTagIds = entry?.colorTagIds ?? [];

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={`group flex min-h-24 flex-col border-b border-r border-border p-2 text-left transition focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground sm:min-h-32 ${
        inCurrentMonth
          ? 'bg-surface hover:bg-background'
          : 'bg-background/50 text-muted hover:bg-background/80'
      } ${isSelected ? 'shadow-[inset_0_0_0_2px_var(--foreground)]' : ''}`}
      onClick={() => {
        if (window.matchMedia('(pointer: coarse)').matches) {
          onOpenDay(date);
          return;
        }

        onSelectDay(date);
      }}
      onDoubleClick={() => onOpenDay(date)}
    >
      <span
        className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-medium ${
          isToday ? 'bg-foreground text-background' : ''
        }`}
      >
        {parsedDate.getDate()}
      </span>

      <span className="mt-2 line-clamp-2 min-h-8 text-xs leading-4 text-muted sm:text-sm">
        {entry?.previewText || dictionaryEmptyLabel}
      </span>

      {entry && entry.itemCount > 0 ? (
        <span className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <span
              className="block h-full rounded-full bg-foreground"
              style={{ width: `${Math.round(completedRatio * 100)}%` }}
            />
          </span>
          <span>
            {entry.completedCount}/{entry.itemCount}
          </span>
        </span>
      ) : null}

      {colorTagIds.length > 0 ? (
        <span className="mt-2 flex gap-1">
          {colorTagIds.slice(0, 4).map((colorTagId) => (
            <span
              key={colorTagId}
              className="size-1.5 rounded-full bg-muted"
              style={{ backgroundColor: colorTagMap.get(colorTagId)?.hex }}
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}
