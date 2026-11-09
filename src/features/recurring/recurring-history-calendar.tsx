'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IconButton } from '@/components/ui';
import {
  getPerformanceMonths,
  getRecurrenceCalendarStatuses,
  type LocalDateString,
  type Recurrence,
  type RecurrenceCalendarStatus,
  type RecurrencePerformance,
} from '@/lib/domain';
import { createMonthGrid } from '@/lib/time';
import { useAppContext } from '@/providers';
import { formatRecurringDate } from './recurrence-format';
import {
  performanceStatusAppearance,
  useStatusLabel,
} from './recurring-performance-parts';

type PerformanceRange = {
  endDate: LocalDateString;
  startDate: LocalDateString;
};

const legendStatuses = [
  'done',
  'not_done',
  'unregistered',
  'pending',
  'future',
  'none',
] as const satisfies readonly RecurrenceCalendarStatus[];

const cellToneClassName: Record<RecurrenceCalendarStatus, string> = {
  done: 'bg-emerald-400/[0.14] text-[#fff9f2]',
  future: 'bg-white/[0.03] text-[#aebac8]',
  none: 'text-[#7b8da0]',
  not_done: 'bg-rose-400/[0.14] text-[#fff9f2]',
  outside: 'text-[#3e4955]',
  pending: 'bg-[#f0c38e]/[0.12] text-[#fff9f2]',
  unregistered: 'bg-white/[0.06] text-[#e5ebf3]',
};

function formatMonth(month: LocalDateString, locale: string): string {
  const [year, monthNumber] = month.split('-').map(Number);

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1, 12)));
}

function resolveInitialMonth(
  months: readonly LocalDateString[],
  range: PerformanceRange,
  today: LocalDateString,
): LocalDateString {
  const focus = range.endDate > today ? today : range.endDate;
  const month = `${focus.slice(0, 7)}-01` as LocalDateString;

  return months.includes(month) ? month : months[months.length - 1];
}

function getMonthWeeks(month: LocalDateString) {
  const days = createMonthGrid(month);
  const lastDay = days.findLastIndex((day) => day.inCurrentMonth);

  return days.slice(0, Math.ceil((lastDay + 1) / 7) * 7);
}

function CalendarCell({
  date,
  isSelected,
  status,
  onSelect,
}: {
  date: LocalDateString;
  isSelected: boolean;
  status: RecurrenceCalendarStatus;
  onSelect: (date: LocalDateString) => void;
}) {
  const { dictionary, locale } = useAppContext();
  const getStatusLabel = useStatusLabel();
  const { Icon, className } = performanceStatusAppearance[status];
  const showsIcon = status !== 'none' && status !== 'outside';

  return (
    <button
      type="button"
      aria-label={dictionary.recurring.dayStatusLabel
        .replace('{date}', formatRecurringDate(date, locale))
        .replace('{status}', getStatusLabel(status))}
      aria-pressed={isSelected}
      disabled={status === 'outside'}
      className={`touch-target flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium tabular-nums transition hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f0c38e] disabled:cursor-default disabled:hover:bg-transparent ${cellToneClassName[status]} ${
        isSelected ? 'inset-ring-2 inset-ring-[#f0c38e]' : ''
      }`}
      onClick={() => onSelect(date)}
    >
      {Number(date.slice(8))}
      {showsIcon ? (
        <Icon aria-hidden="true" className={`size-3 ${className}`} />
      ) : (
        <span aria-hidden="true" className="size-3" />
      )}
    </button>
  );
}

function CalendarMonthNav({
  month,
  months,
  onChange,
}: {
  month: LocalDateString;
  months: readonly LocalDateString[];
  onChange: (month: LocalDateString) => void;
}) {
  const { dictionary, locale } = useAppContext();
  const monthIndex = months.indexOf(month);

  return (
    <div className="flex items-center justify-between gap-2">
      <IconButton
        aria-label={dictionary.calendar.previousMonth}
        disabled={monthIndex <= 0}
        size="compact"
        className="rounded-full"
        onClick={() => onChange(months[monthIndex - 1])}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </IconButton>
      <p
        aria-live="polite"
        className="text-sm font-semibold text-[#fff9f2] first-letter:uppercase"
      >
        {formatMonth(month, locale)}
      </p>
      <IconButton
        aria-label={dictionary.calendar.nextMonth}
        disabled={monthIndex >= months.length - 1}
        size="compact"
        className="rounded-full"
        onClick={() => onChange(months[monthIndex + 1])}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </IconButton>
    </div>
  );
}

function SelectedDayResult({
  date,
  status,
}: {
  date: LocalDateString | null;
  status: RecurrenceCalendarStatus | undefined;
}) {
  const { dictionary, locale } = useAppContext();
  const getStatusLabel = useStatusLabel();

  return (
    <p
      aria-live="polite"
      className="min-h-5 px-1 text-sm text-[#e5ebf3] first-letter:uppercase"
    >
      {date && status
        ? dictionary.recurring.dayStatusLabel
            .replace('{date}', formatRecurringDate(date, locale))
            .replace('{status}', getStatusLabel(status))
        : null}
    </p>
  );
}

function CalendarLegend() {
  const labels = useAppContext().dictionary.recurring;
  const getStatusLabel = useStatusLabel();

  return (
    <ul
      aria-label={labels.legendLabel}
      className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-[#aebac8]"
    >
      {legendStatuses.map((status) => {
        const { Icon, className } = performanceStatusAppearance[status];

        return (
          <li key={status} className="flex items-center gap-1">
            <Icon aria-hidden="true" className={`size-3 ${className}`} />
            {getStatusLabel(status)}
          </li>
        );
      })}
    </ul>
  );
}

export function RecurringHistoryCalendar({
  performance,
  range,
  recurrence,
  selectedDate,
  today,
  onSelect,
}: {
  performance: RecurrencePerformance;
  range: PerformanceRange;
  recurrence: Recurrence;
  selectedDate: LocalDateString | null;
  today: LocalDateString;
  onSelect: (date: LocalDateString) => void;
}) {
  const { dictionary } = useAppContext();
  const months = getPerformanceMonths(range.startDate, range.endDate);
  const [month, setMonth] = useState(() =>
    resolveInitialMonth(months, range, today),
  );
  const grid = useMemo(() => getMonthWeeks(month), [month]);
  const statuses = useMemo(
    () =>
      getRecurrenceCalendarStatuses({
        dates: grid.map((day) => day.date),
        performance,
        range,
        recurrence,
        today,
      }),
    [grid, performance, range, recurrence, today],
  );

  return (
    <section
      aria-label={dictionary.recurring.calendarLabel}
      className="flex flex-col gap-2 rounded-lg bg-white/[0.035] p-3"
    >
      <CalendarMonthNav month={month} months={months} onChange={setMonth} />
      <div className="grid grid-cols-7 gap-1">
        {dictionary.calendar.weekdays.map((weekday) => (
          <span
            key={weekday}
            aria-hidden="true"
            className="text-center text-[0.6875rem] font-medium text-[#7b8da0]"
          >
            {weekday}
          </span>
        ))}
        {grid.map((day) =>
          day.inCurrentMonth ? (
            <CalendarCell
              key={day.date}
              date={day.date}
              isSelected={day.date === selectedDate}
              status={statuses.get(day.date) ?? 'outside'}
              onSelect={onSelect}
            />
          ) : (
            <span key={day.date} aria-hidden="true" />
          ),
        )}
      </div>
      <SelectedDayResult
        date={selectedDate}
        status={selectedDate ? statuses.get(selectedDate) : undefined}
      />
      <CalendarLegend />
    </section>
  );
}
