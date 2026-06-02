'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { BulkCalendarEditor } from '@/features/calendar/bulk-calendar-editor';
import { DayEditor } from '@/features/day-editor';
import type {
  DailyEntry,
  DailyEntryCategorySummary,
  LocalDateString,
} from '@/lib/domain';
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

function createMonthKey(year: number, monthIndex: number): LocalDateString {
  return createLocalDateKey(year, monthIndex, 1);
}

function getMonthParts(monthDate: LocalDateString) {
  const parsedDate = parseLocalDateKey(monthDate);

  return {
    year: parsedDate.getFullYear(),
    monthIndex: parsedDate.getMonth(),
  };
}

function formatMonthButtonLabel(
  monthIndex: number,
  locale: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: timezone,
  })
    .format(new Date(Date.UTC(2026, monthIndex, 15, 12)))
    .replaceAll('.', '')
    .slice(0, 3);
}

function entriesByDate(
  entries: DailyEntry[],
): Map<LocalDateString, DailyEntry> {
  return new Map(entries.map((entry) => [entry.date, entry]));
}

function getProgressTone(completedRatio: number) {
  if (completedRatio >= 1) {
    return {
      badgeStyle: {
        color: '#15803d',
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
        borderColor: 'rgba(34, 197, 94, 0.22)',
      },
      trackStyle: {
        backgroundColor: 'rgba(34, 197, 94, 0.16)',
      },
      fillStyle: {
        background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
        boxShadow: '0 0 14px rgba(34, 197, 94, 0.28)',
      },
    };
  }

  if (completedRatio > 0) {
    return {
      badgeStyle: {
        color: '#b45309',
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        borderColor: 'rgba(245, 158, 11, 0.24)',
      },
      trackStyle: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
      },
      fillStyle: {
        background: 'linear-gradient(90deg, #fcd34d 0%, #f59e0b 100%)',
        boxShadow: '0 0 14px rgba(245, 158, 11, 0.24)',
      },
    };
  }

  return {
    badgeStyle: {
      color: 'var(--muted)',
      backgroundColor: 'rgba(113, 113, 122, 0.12)',
      borderColor: 'rgba(113, 113, 122, 0.18)',
    },
    trackStyle: {
      backgroundColor: 'rgba(113, 113, 122, 0.14)',
    },
    fillStyle: {
      background: 'linear-gradient(90deg, #a1a1aa 0%, #71717a 100%)',
      boxShadow: 'none',
    },
  };
}

function isCategoryComplete(
  summary: DailyEntryCategorySummary | undefined,
): boolean {
  return Boolean(
    summary &&
    summary.itemCount > 0 &&
    summary.completedCount >= summary.itemCount,
  );
}

export function CalendarMonth() {
  const { dictionary, locale, scope, timezonePreference } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayKey = getTodayKey(timezonePreference.timezone);
  const { year: todayYear, monthIndex: todayMonthIndex } =
    getMonthParts(todayKey);
  const dayParam = searchParams.get('day');
  const openDayDate = dayParam && isLocalDateString(dayParam) ? dayParam : null;
  const [bulkEditorMode, setBulkEditorMode] = useState<
    'create' | 'clear' | null
  >(null);
  const [visibleYear, setVisibleYear] = useState<number>(() => todayYear);
  const [visibleMonthIndex, setVisibleMonthIndex] = useState<number>(
    () => todayMonthIndex,
  );
  const [selectedDay, setSelectedDay] = useState<LocalDateString | null>(
    todayKey,
  );
  const visibleMonth = useMemo(
    () => createMonthKey(visibleYear, visibleMonthIndex),
    [visibleMonthIndex, visibleYear],
  );
  const entries = useMonthEntries(scope, visibleMonth);
  const categoryTags = useCategoryTags(scope, 'calendar');
  const entryMap = useMemo(() => entriesByDate(entries), [entries]);
  const categoryTagMap = useMemo(
    () => new Map(categoryTags.map((tag) => [tag.id, tag])),
    [categoryTags],
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
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        monthIndex,
        label: formatMonthButtonLabel(
          monthIndex,
          locale,
          timezonePreference.timezone,
        ),
      })),
    [locale, timezonePreference.timezone],
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
      <section className="card-surface-strong flex min-h-[70vh] flex-col overflow-hidden">
        <header className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CalendarDays aria-hidden="true" className="size-5 text-muted" />
              <h2 className="truncate text-lg font-semibold capitalize">
                {monthLabel}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                className="min-h-10 px-3"
                onClick={() => setBulkEditorMode('create')}
              >
                <Plus aria-hidden="true" className="size-4" />
                {dictionary.calendar.bulkCreate}
              </Button>
              <Button
                className="min-h-10 bg-rose-600 px-3 text-white shadow-[0_14px_28px_rgba(225,29,72,0.18)] hover:bg-rose-500"
                onClick={() => setBulkEditorMode('clear')}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {dictionary.calendar.bulkClear}
              </Button>
              <button
                type="button"
                aria-label={dictionary.calendar.previousYear}
                className="inline-flex size-10 items-center justify-center rounded-full bg-background/55 text-muted shadow-sm transition hover:bg-accent/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                onClick={() => setVisibleYear((currentYear) => currentYear - 1)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <div className="min-w-16 text-center text-sm font-semibold tabular-nums text-foreground">
                {visibleYear}
              </div>
              <button
                type="button"
                aria-label={dictionary.calendar.nextYear}
                className="inline-flex size-10 items-center justify-center rounded-full bg-background/55 text-muted shadow-sm transition hover:bg-accent/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                onClick={() => setVisibleYear((currentYear) => currentYear + 1)}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                className="h-10 rounded-full bg-background/55 px-3 text-sm font-medium shadow-sm transition hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                onClick={() => {
                  setVisibleYear(todayYear);
                  setVisibleMonthIndex(todayMonthIndex);
                  setSelectedDay(todayKey);
                }}
              >
                {dictionary.calendar.today}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-12">
            {monthOptions.map((monthOption) => (
              <button
                key={monthOption.monthIndex}
                type="button"
                aria-pressed={visibleMonthIndex === monthOption.monthIndex}
                className={`h-10 rounded-full px-3 text-sm font-medium uppercase tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                  visibleMonthIndex === monthOption.monthIndex
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background/55 text-muted shadow-sm hover:bg-accent/25 hover:text-foreground'
                }`}
                onClick={() => setVisibleMonthIndex(monthOption.monthIndex)}
              >
                {monthOption.label}
              </button>
            ))}
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
              entry={entryMap.get(day.date) ?? null}
              categoryTagMap={categoryTagMap}
              inCurrentMonth={day.inCurrentMonth}
              isSelected={(openDayDate ?? selectedDay) === day.date}
              isToday={todayKey === day.date}
              onOpenDay={openDay}
              onSelectDay={selectDay}
            />
          ))}
        </div>
      </section>
      <BulkCalendarEditor
        mode={bulkEditorMode ?? 'create'}
        open={bulkEditorMode !== null}
        onClose={() => setBulkEditorMode(null)}
      />
      <DayEditor date={openDayDate} onClose={closeDay} />
    </>
  );
}

function DayCell({
  date,
  entry,
  categoryTagMap,
  inCurrentMonth,
  isSelected,
  isToday,
  onOpenDay,
  onSelectDay,
}: {
  date: LocalDateString;
  entry: DailyEntry | null;
  categoryTagMap: Map<string, { colorHex: string }>;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onOpenDay: (date: LocalDateString) => void;
  onSelectDay: (date: LocalDateString) => void;
}) {
  const parsedDate = parseLocalDateKey(date);
  const completedRatio =
    entry && entry.itemCount > 0 ? entry.completedCount / entry.itemCount : 0;
  const categoryTagIds = entry?.categoryTagIds ?? [];
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

      <div className="mt-auto flex flex-col gap-2 pt-4">
        {entry && entry.itemCount > 0 ? (
          <span className="flex flex-col gap-1.5 pt-2 text-xs">
            <span
              className="inline-flex w-fit items-center rounded-full border px-2 py-1 text-[11px] font-semibold leading-none tabular-nums"
              style={progressTone.badgeStyle}
            >
              {entry.completedCount}/{entry.itemCount}
            </span>
            <span
              className="h-2 w-full overflow-hidden rounded-full"
              style={progressTone.trackStyle}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-200"
                style={{
                  ...progressTone.fillStyle,
                  width: `${Math.round(completedRatio * 100)}%`,
                }}
              />
            </span>
          </span>
        ) : null}

        {categoryTagIds.length > 0 ? (
          <span className="flex gap-1.5 pt-0.5">
            {categoryTagIds.slice(0, 4).map((categoryTagId) =>
              (() => {
                const colorHex = categoryTagMap.get(categoryTagId)?.colorHex;
                const completed = isCategoryComplete(
                  categorySummaryMap.get(categoryTagId),
                );

                return (
                  <span
                    key={categoryTagId}
                    className="size-3 rounded-full border border-white/60 transition-opacity dark:border-black/20"
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
          </span>
        ) : null}
      </div>
    </button>
  );
}
