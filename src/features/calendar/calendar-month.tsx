'use client';

import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileJson,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BottomSheet, BottomSheetAction, IconButton } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { BulkCalendarEditor } from '@/features/calendar/bulk-calendar-editor';
import { CalendarImportDialog } from '@/features/calendar/calendar-import-dialog';
import { DayDetail } from '@/features/day-editor';
import { useMonthDayPreviews } from '@/features/calendar/use-month-day-previews';
import type { DailyEntry, LocalDateString } from '@/lib/domain';
import { formatMonthLabel } from '@/lib/i18n';
import {
  createLocalDateKey,
  createMonthGrid,
  getTodayKey,
  isLocalDateString,
  parseLocalDateKey,
} from '@/lib/time';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';
import { useTouchComposition } from '@/hooks/use-touch-composition';
import { useAppContext } from '@/providers';
import { CalendarMonthGrid } from './calendar-month-grid';
import { CalendarMonthSheet } from './calendar-month-sheet';
import { CalendarWeekView } from './calendar-week-view';
import { useCalendarSelectedDay } from './use-calendar-selected-day';
import { useMonthEntries } from './use-month-entries';
import { useCalendarVisibleMonth } from './use-calendar-visible-month';

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
  const [isMonthSheetOpen, setIsMonthSheetOpen] = useState(false);
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  const currentMonth = createMonthKey(todayYear, todayMonthIndex);
  const { selectVisibleMonth, visibleMonth } = useCalendarVisibleMonth(
    scope,
    currentMonth,
  );
  const { year: visibleYear, monthIndex: visibleMonthIndex } =
    getMonthParts(visibleMonth);
  const [selectedDay, setSelectedDay] = useState<LocalDateString | null>(
    todayKey,
  );
  const isTouchComposition = useTouchComposition();
  const { selectPersistedDay, selectedDay: persistedDay } =
    useCalendarSelectedDay(scope, todayKey);
  const activeDay =
    openDayDate ??
    (isTouchComposition ? persistedDay : (selectedDay ?? todayKey));
  const entries = useMonthEntries(scope, visibleMonth);
  const dayPreviews = useMonthDayPreviews(scope, entries);
  const categoryTags = useCategoryTags(scope, 'checklist_item');
  const isCoarsePointer = useCoarsePointer();
  const monthStripRef = useRef<HTMLDivElement | null>(null);
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
  }, [pathname, router, searchParams, setOpenDayOverride]);
  const openDay = useCallback(
    (date: LocalDateString) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('day', date);
      setSelectedDay(date);
      setOpenDayOverride(date);
      router.push(`${pathname}?${nextSearchParams.toString()}`);
    },
    [pathname, router, searchParams, setOpenDayOverride, setSelectedDay],
  );
  const selectDay = useCallback(
    (date: LocalDateString) => {
      setSelectedDay(date);

      const { year, monthIndex } = getMonthParts(date);
      const dayMonth = createMonthKey(year, monthIndex);

      if (!isTouchComposition) {
        return;
      }

      if (dayMonth !== visibleMonth) {
        selectVisibleMonth(dayMonth);
      }

      selectPersistedDay(date);
    },
    [isTouchComposition, selectPersistedDay, selectVisibleMonth, visibleMonth],
  );

  useEffect(() => {
    const strip = monthStripRef.current;

    if (!strip || strip.scrollWidth <= strip.clientWidth) {
      return;
    }

    const activeTab = strip.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );

    if (!activeTab) {
      return;
    }

    const left = Math.max(
      0,
      activeTab.offsetLeft - (strip.clientWidth - activeTab.offsetWidth) / 2,
    );

    if (typeof strip.scrollTo === 'function') {
      strip.scrollTo({ behavior: 'smooth', left });
      return;
    }

    strip.scrollLeft = left;
  }, [visibleMonthIndex]);

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
              <span className="hidden shrink-0 touch:inline-flex">
                <IconButton
                  aria-label={dictionary.calendar.openMonth}
                  className="size-8 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
                  onClick={() => setIsMonthSheetOpen(true)}
                >
                  <CalendarRange aria-hidden="true" className="size-4" />
                </IconButton>
              </span>
              <span className="ml-auto hidden shrink-0 touch:inline-flex">
                <IconButton
                  aria-label={dictionary.calendar.moreActions}
                  className="size-8 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
                  onClick={() => setIsActionsSheetOpen(true)}
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </IconButton>
              </span>
            </div>

            <div
              aria-label={dictionary.calendar.today}
              className="flex h-8 w-fit items-center gap-1 rounded-full touch:hidden inset-ring-hairline inset-ring-white/10 bg-white/4 px-1 shadow-sm shadow-[#253241]/10"
            >
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-full px-3 text-sm font-medium text-[#cbd5e0] transition hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
                onClick={() => {
                  selectVisibleMonth(currentMonth);
                  selectDay(todayKey);
                }}
              >
                {dictionary.calendar.today}
              </button>
              <span aria-hidden="true" className="h-5 w-px bg-white/10" />
              <IconButton
                aria-label={dictionary.calendar.previousYear}
                className="size-7 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/12 focus-visible:outline-[#f7d9b0]"
                onClick={() =>
                  selectVisibleMonth(
                    createMonthKey(visibleYear - 1, visibleMonthIndex),
                  )
                }
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </IconButton>
              <span className="min-w-14 px-1 text-center text-sm font-semibold tabular-nums text-[#fff9f2]">
                {visibleYear}
              </span>
              <IconButton
                aria-label={dictionary.calendar.nextYear}
                className="size-7 rounded-full text-[#cbd5e0] hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/12 focus-visible:outline-[#f7d9b0]"
                onClick={() =>
                  selectVisibleMonth(
                    createMonthKey(visibleYear + 1, visibleMonthIndex),
                  )
                }
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </IconButton>
            </div>
          </div>

          <div className="flex flex-col gap-2 touch:hidden xl:flex-row xl:items-center xl:justify-between">
            <div
              ref={monthStripRef}
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
                  onClick={() =>
                    selectVisibleMonth(
                      createMonthKey(visibleYear, monthOption.monthIndex),
                    )
                  }
                >
                  {monthOption.label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 touch:hidden">
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

        {isTouchComposition ? (
          <CalendarWeekView
            activeDay={activeDay}
            categoryTagMap={categoryTagMap}
            dayPreviews={dayPreviews}
            entryMap={entryMap}
            todayKey={todayKey}
            visibleMonth={visibleMonth}
            onSelectDay={selectDay}
          />
        ) : (
          <CalendarMonthGrid
            activeDay={activeDay}
            categoryTagMap={categoryTagMap}
            dayPreviews={dayPreviews}
            entryMap={entryMap}
            monthGrid={monthGrid}
            opensOnSingleTap={isCoarsePointer}
            todayKey={todayKey}
            onOpenDay={openDay}
            onSelectDay={selectDay}
          />
        )}
      </section>
      <CalendarMonthSheet
        activeDay={activeDay}
        categoryTagMap={categoryTagMap}
        dayPreviews={dayPreviews}
        entryMap={entryMap}
        monthGrid={monthGrid}
        open={isMonthSheetOpen}
        periodLabel={periodLabel}
        todayKey={todayKey}
        onClose={() => setIsMonthSheetOpen(false)}
        onSelectDay={(date) => {
          selectDay(date);
          setIsMonthSheetOpen(false);
        }}
        onSelectMonthOffset={(monthOffset) =>
          selectVisibleMonth(
            createMonthKey(visibleYear, visibleMonthIndex + monthOffset),
          )
        }
      />
      <BottomSheet
        closeLabel={dictionary.actions.cancel}
        open={isActionsSheetOpen}
        title={dictionary.calendar.moreActions}
        onClose={() => setIsActionsSheetOpen(false)}
      >
        <BottomSheetAction
          icon={<Plus aria-hidden="true" className="size-4 text-[#f0c38e]" />}
          onSelect={() => {
            setIsActionsSheetOpen(false);
            setBulkEditorMode('create');
          }}
        >
          {dictionary.calendar.bulkCreate}
        </BottomSheetAction>
        <BottomSheetAction
          icon={<FileJson aria-hidden="true" className="size-4" />}
          onSelect={() => {
            setIsActionsSheetOpen(false);
            setIsImportOpen(true);
          }}
        >
          {dictionary.calendar.importCreate}
        </BottomSheetAction>
        <BottomSheetAction
          icon={<Trash2 aria-hidden="true" className="size-4" />}
          onSelect={() => {
            setIsActionsSheetOpen(false);
            setBulkEditorMode('clear');
          }}
        >
          {dictionary.calendar.bulkClear}
        </BottomSheetAction>
      </BottomSheet>
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
