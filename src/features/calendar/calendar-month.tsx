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

function formatDayLabel(
  date: LocalDateString,
  locale: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(createMonthLabelDate(date));
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
  const activeDay = openDayDate ?? selectedDay ?? todayKey;
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
  const selectedDayLabel = formatDayLabel(
    activeDay,
    locale,
    timezonePreference.timezone,
  );
  const selectedDayEntry = entryMap.get(activeDay) ?? null;
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
      <section className="calendar-shell flex min-h-[70vh] flex-col overflow-hidden">
        <header className="calendar-header-panel flex flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#f0c38e] shadow-sm shadow-[#312c51]/10">
                <CalendarDays aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-[#d8d0e8]">
                  {dictionary.calendar.title}
                </p>
                <h2 className="mt-1 truncate text-2xl font-semibold capitalize sm:text-3xl">
                  {monthLabel}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button
                className="min-h-10 px-4 shadow-sm shadow-[#f0c38e]/12"
                tone="accent"
                onClick={() => setBulkEditorMode('create')}
              >
                <Plus aria-hidden="true" className="size-4" />
                {dictionary.calendar.bulkCreate}
              </Button>
              <Button
                className="min-h-10 px-4"
                tone="subtle"
                onClick={() => setBulkEditorMode('clear')}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {dictionary.calendar.bulkClear}
              </Button>
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 shadow-sm shadow-[#312c51]/10">
                <button
                  type="button"
                  aria-label={dictionary.calendar.previousYear}
                  className="inline-flex size-9 items-center justify-center rounded-full text-[#d8d0e8] transition hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
                  onClick={() =>
                    setVisibleYear((currentYear) => currentYear - 1)
                  }
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <div className="min-w-14 px-1 text-center text-sm font-semibold tabular-nums text-[#fff9f2]">
                  {visibleYear}
                </div>
                <button
                  type="button"
                  aria-label={dictionary.calendar.nextYear}
                  className="inline-flex size-9 items-center justify-center rounded-full text-[#d8d0e8] transition hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
                  onClick={() =>
                    setVisibleYear((currentYear) => currentYear + 1)
                  }
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-full bg-white/6 px-3 text-sm font-medium text-[#d8d0e8] transition hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
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
          </div>

          <div className="calendar-month-strip -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
            {monthOptions.map((monthOption) => (
              <button
                key={monthOption.monthIndex}
                type="button"
                aria-pressed={visibleMonthIndex === monthOption.monthIndex}
                className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium uppercase tracking-[0.16em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
                  visibleMonthIndex === monthOption.monthIndex
                    ? 'border-[#f3d2aa] bg-[#f0c38e] text-[#312c51] shadow-[0_12px_30px_rgba(240,195,142,0.18)]'
                    : 'border-white/10 bg-white/5 text-[#c4bbda] hover:border-white/15 hover:bg-white/10 hover:text-[#fff9f2]'
                }`}
                onClick={() => setVisibleMonthIndex(monthOption.monthIndex)}
              >
                {monthOption.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-7 border-y border-white/8 bg-white/4 text-center text-[0.68rem] font-medium uppercase tracking-[0.28em] text-[#bdb4d4]">
          {dictionary.calendar.weekdays.map((weekday) => (
            <div key={weekday} className="px-2 py-3">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="calendar-day-grid grid grid-cols-7 auto-rows-fr">
            {monthGrid.map((day) => (
              <DayCell
                key={day.date}
                date={day.date}
                entry={entryMap.get(day.date) ?? null}
                categoryTagMap={categoryTagMap}
                inCurrentMonth={day.inCurrentMonth}
                isSelected={activeDay === day.date}
                isToday={todayKey === day.date}
                onOpenDay={openDay}
                onSelectDay={selectDay}
              />
            ))}
          </div>

          <aside className="border-t border-white/8 bg-white/4 p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="h-full rounded-[1.5rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 shadow-sm shadow-[#312c51]/10 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-tight text-[#fff9f2]">
                    {selectedDayLabel}
                  </h3>
                </div>
                {activeDay === todayKey ? (
                  <span className="calendar-chip px-2.5 py-1 text-[11px] font-semibold text-[#f7e8ce]">
                    {dictionary.calendar.today}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-[1.25rem] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                {selectedDayEntry ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="calendar-chip px-3 py-1 text-xs font-medium text-[#f7e8ce]">
                        {selectedDayEntry.completedCount}/
                        {selectedDayEntry.itemCount}
                      </span>
                      {selectedDayEntry.itemCount > 0 ? (
                        <span className="text-xs text-[#bdb4d4]">
                          {Math.round(
                            (selectedDayEntry.completedCount /
                              selectedDayEntry.itemCount) *
                              100,
                          )}
                          %
                        </span>
                      ) : null}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#f7e1bc_0%,#f0c38e_100%)]"
                        style={{
                          width: `${
                            selectedDayEntry.itemCount > 0
                              ? Math.round(
                                  (selectedDayEntry.completedCount /
                                    selectedDayEntry.itemCount) *
                                    100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    {selectedDayEntry.categoryTagIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDayEntry.categoryTagIds
                          .slice(0, 4)
                          .map((categoryTagId) => {
                            const colorHex =
                              categoryTagMap.get(categoryTagId)?.colorHex;
                            const completed = isCategoryComplete(
                              selectedDayEntry.categorySummaries?.find(
                                (summary) =>
                                  summary.categoryTagId === categoryTagId,
                              ),
                            );

                            return (
                              <span
                                key={categoryTagId}
                                className="size-3 rounded-full border border-white/50"
                                style={{
                                  backgroundColor: colorHex,
                                  opacity: completed ? 1 : 0.3,
                                  boxShadow:
                                    completed && colorHex
                                      ? `0 0 0 1px rgba(255, 255, 255, 0.22), 0 0 10px ${colorHex}33`
                                      : 'none',
                                }}
                              />
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[#bdb4d4]">
                    {dictionary.calendar.emptyDay}
                  </p>
                )}
              </div>
            </div>
          </aside>
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
      className={`group calendar-day-cell flex flex-col text-left ${
        inCurrentMonth
          ? 'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]'
          : 'bg-[rgba(255,255,255,0.01)] text-[#8f85aa] hover:bg-[rgba(255,255,255,0.03)]'
      } ${
        isSelected
          ? 'relative z-10 border-[#f3d2aa]/40 bg-[linear-gradient(180deg,rgba(240,195,142,0.18),rgba(255,255,255,0.04))] shadow-[inset_0_0_0_1px_rgba(243,210,170,0.6),0_0_0_1px_rgba(243,210,170,0.12),0_18px_28px_rgba(8,6,20,0.18)]'
          : 'shadow-none'
      }`}
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
        className={`calendar-day-number ${
          isSelected
            ? 'bg-[#f7e1bc] text-[#312c51] shadow-[0_8px_18px_rgba(240,195,142,0.2)]'
            : isToday
              ? 'bg-white/10 text-[#f7e1bc] ring-1 ring-inset ring-[#f7e1bc]/35'
              : 'bg-transparent text-inherit'
        }`}
      >
        {parsedDate.getDate()}
      </span>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        {entry && entry.itemCount > 0 ? (
          <span className="flex flex-col gap-1.5 pt-2 text-xs">
            <span
              className="calendar-chip w-fit px-2 py-1 text-[11px] font-semibold leading-none tabular-nums text-[#f7e8ce]"
              style={progressTone.badgeStyle}
            >
              {entry.completedCount}/{entry.itemCount}
            </span>
            <span
              className="h-2 w-full overflow-hidden rounded-full bg-white/6"
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
                    className="size-3 rounded-full border border-white/35 transition-opacity"
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
