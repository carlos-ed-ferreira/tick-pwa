'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileJson,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconButton } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { BulkCalendarEditor } from '@/features/calendar/bulk-calendar-editor';
import { CalendarImportDialog } from '@/features/calendar/calendar-import-dialog';
import { DayDetail } from '@/features/day-editor';
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

function formatPeriodLabel(label: string): string {
  return label ? label.charAt(0).toLocaleUpperCase() + label.slice(1) : label;
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
        '--calendar-chip-edge': 'rgba(34, 197, 94, 0.22)',
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
        '--calendar-chip-edge': 'rgba(245, 158, 11, 0.24)',
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
      '--calendar-chip-edge': 'rgba(113, 113, 122, 0.18)',
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
  const dayParamDate =
    dayParam && isLocalDateString(dayParam) ? dayParam : null;
  const [openDayOverride, setOpenDayOverride] = useState<
    LocalDateString | null | undefined
  >(undefined);
  const openDayDate =
    openDayOverride === undefined ? dayParamDate : openDayOverride;
  const [bulkEditorMode, setBulkEditorMode] = useState<
    'create' | 'clear' | null
  >(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
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
  const categoryTags = useCategoryTags(scope, 'checklist_item');
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
  const periodLabel = formatPeriodLabel(monthLabel);
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

    setOpenDayOverride(null);
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, router, searchParams]);
  const openDay = useCallback(
    (date: LocalDateString) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('day', date);
      setSelectedDay(date);
      setOpenDayOverride(date);
      router.push(`${pathname}?${nextSearchParams.toString()}`);
    },
    [pathname, router, searchParams],
  );
  const selectDay = useCallback((date: LocalDateString) => {
    setSelectedDay(date);
  }, []);

  useEffect(() => {
    const clearNavigationOverride = () => {
      setOpenDayOverride(undefined);
    };

    window.addEventListener('popstate', clearNavigationOverride);

    return () => {
      window.removeEventListener('popstate', clearNavigationOverride);
    };
  }, []);

  if (openDayDate) {
    return <DayDetail date={openDayDate} onBack={closeDay} />;
  }

  return (
    <>
      <section className="calendar-shell flex min-h-[70vh] flex-col overflow-hidden lg:min-h-0 lg:flex-1">
        <header className="calendar-header-panel flex flex-col gap-2.5 px-4 py-2.5 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full inset-ring-hairline inset-ring-[#f0c38e]/24 bg-[#f0c38e]/10 text-[#f0c38e] shadow-sm shadow-[#253241]/10">
                <CalendarDays aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold sm:text-xl">
                  {periodLabel}
                </h2>
              </div>
            </div>

            <div
              aria-label={dictionary.calendar.today}
              className="flex h-8 w-fit items-center gap-1 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/4 px-1 shadow-sm shadow-[#253241]/10"
            >
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-full px-3 text-sm font-medium text-[#cbd5e0] transition hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
                onClick={() => {
                  setVisibleYear(todayYear);
                  setVisibleMonthIndex(todayMonthIndex);
                  setSelectedDay(todayKey);
                }}
              >
                {dictionary.calendar.today}
              </button>
              <span aria-hidden="true" className="h-5 w-px bg-white/10" />
              <IconButton
                aria-label={dictionary.calendar.previousYear}
                className="size-7 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/12 focus-visible:outline-[#f7d9b0]"
                onClick={() => setVisibleYear((currentYear) => currentYear - 1)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </IconButton>
              <span className="min-w-14 px-1 text-center text-sm font-semibold tabular-nums text-[#fff9f2]">
                {visibleYear}
              </span>
              <IconButton
                aria-label={dictionary.calendar.nextYear}
                className="size-7 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/12 focus-visible:outline-[#f7d9b0]"
                onClick={() => setVisibleYear((currentYear) => currentYear + 1)}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </IconButton>
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div
              role="tablist"
              aria-label={periodLabel}
              className="calendar-month-strip flex flex-1 items-center gap-1 overflow-x-auto rounded-full inset-ring-hairline inset-ring-white/8 bg-white/[0.025] p-0.5 sm:justify-between"
            >
              {monthOptions.map((monthOption) => (
                <button
                  key={monthOption.monthIndex}
                  type="button"
                  role="tab"
                  aria-selected={visibleMonthIndex === monthOption.monthIndex}
                  className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full inset-ring-hairline px-2.5 text-xs font-medium uppercase leading-none tracking-[0.16em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
                    visibleMonthIndex === monthOption.monthIndex
                      ? 'inset-ring-[#f3d2aa] bg-[#f0c38e] text-[#253241] shadow-[0_12px_30px_rgba(240,195,142,0.16)]'
                      : 'inset-ring-transparent bg-transparent text-[#98a6b5] hover:inset-ring-white/10 hover:bg-white/6 hover:text-[#fff9f2] active:bg-white/10'
                  }`}
                  onClick={() => setVisibleMonthIndex(monthOption.monthIndex)}
                >
                  {monthOption.label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="group inline-flex h-9 items-center gap-2 rounded-[0.75rem] inset-ring-hairline inset-ring-[#f8d7aa]/70 bg-[#f0c38e] pl-1.5 pr-3 text-left text-[#253241] shadow-md shadow-[#f0c38e]/18 transition hover:inset-ring-[#ffe0b8] hover:bg-[#f5d09f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-65"
                onClick={() => setBulkEditorMode('create')}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-[0.5rem] bg-[#253241]/10 text-[#253241]">
                  <Plus aria-hidden="true" className="size-4" />
                </span>
                <span className="text-sm font-semibold">
                  {dictionary.calendar.bulkCreate}
                </span>
              </button>
              <button
                type="button"
                className="group inline-flex h-9 items-center gap-2 rounded-[0.75rem] inset-ring-hairline inset-ring-[#fff9f2]/22 bg-[#fff9f2]/10 pl-1.5 pr-3 text-left text-[#fff9f2] shadow-sm shadow-[#253241]/8 transition hover:inset-ring-[#fff9f2]/34 hover:bg-[#fff9f2]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-65"
                onClick={() => setIsImportOpen(true)}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-[0.5rem] bg-[#fff9f2]/12 text-[#fff9f2]">
                  <FileJson aria-hidden="true" className="size-4" />
                </span>
                <span className="text-sm font-semibold">
                  {dictionary.calendar.importCreate}
                </span>
              </button>
              <button
                type="button"
                className="group inline-flex h-9 items-center gap-2 rounded-[0.75rem] inset-ring-hairline inset-ring-[#fff9f2]/22 bg-[#fff9f2]/10 pl-1.5 pr-3 text-left text-[#fff9f2] shadow-sm shadow-[#253241]/8 transition hover:inset-ring-[#fff9f2]/34 hover:bg-[#fff9f2]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-65"
                onClick={() => setBulkEditorMode('clear')}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-[0.5rem] bg-[#fff9f2]/12 text-[#fff9f2]">
                  <Trash2 aria-hidden="true" className="size-4" />
                </span>
                <span className="text-sm font-semibold">
                  {dictionary.calendar.bulkClear}
                </span>
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-7 border-y border-white/8 bg-white/4 text-center text-[0.68rem] font-medium uppercase tracking-[0.28em] text-[#aebac8]">
          {dictionary.calendar.weekdays.map((weekday) => (
            <div key={weekday} className="px-2 py-1.5">
              {weekday}
            </div>
          ))}
        </div>

        <div className="calendar-day-grid grid min-h-0 flex-1 grid-cols-7 auto-rows-fr">
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
      </section>
      <BulkCalendarEditor
        mode={bulkEditorMode ?? 'create'}
        open={bulkEditorMode !== null}
        onClose={() => setBulkEditorMode(null)}
      />
      <CalendarImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
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
        inCurrentMonth || isSelected
          ? 'bg-[rgba(255,255,255,0.012)] hover:bg-[rgba(255,255,255,0.045)]'
          : 'bg-transparent text-[#6a7a8b] opacity-40 hover:bg-[rgba(255,255,255,0.03)] hover:opacity-80'
      } ${
        isSelected
          ? 'relative z-10 border-[#f3d2aa]/40 bg-[linear-gradient(180deg,rgba(240,195,142,0.14),rgba(255,255,255,0.025))] shadow-[inset_0_0_0_1px_rgba(243,210,170,0.6),0_0_0_1px_rgba(243,210,170,0.12),0_18px_28px_rgba(5,8,13,0.18)]'
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
            ? 'bg-[#f7e1bc] text-[#253241] shadow-[0_8px_18px_rgba(240,195,142,0.2)]'
            : isToday
              ? 'bg-white/10 text-[#f7e1bc] inset-ring-hairline inset-ring-[#f7e1bc]/35'
              : 'bg-transparent text-inherit'
        }`}
      >
        {parsedDate.getDate()}
      </span>

      <div className="mt-auto flex flex-col gap-1 pt-1.5">
        {entry && entry.itemCount > 0 ? (
          <span className="flex flex-col gap-1 pt-1 text-xs">
            <span
              className="calendar-chip w-fit px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-[#f7e8ce]"
              style={progressTone.badgeStyle}
            >
              {entry.completedCount}/{entry.itemCount}
            </span>
            <span
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/6"
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
          <span className="flex gap-1.5">
            {categoryTagIds.slice(0, 4).map((categoryTagId) =>
              (() => {
                const colorHex = categoryTagMap.get(categoryTagId)?.colorHex;
                const completed = isCategoryComplete(
                  categorySummaryMap.get(categoryTagId),
                );

                return (
                  <span
                    key={categoryTagId}
                    className="size-2.5 rounded-full inset-ring-hairline inset-ring-white/35 transition-opacity"
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
