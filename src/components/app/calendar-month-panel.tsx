'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { IconButton } from '@/components/ui';
import type { LocalDateString } from '@/lib/domain';
import {
  createLocalDateKey,
  createMonthGrid,
  parseLocalDateKey,
} from '@/lib/time';
import { useAppContext } from '@/providers';

function moveMonth(
  monthDate: LocalDateString,
  monthOffset: number,
): LocalDateString {
  const date = parseLocalDateKey(monthDate);

  return createLocalDateKey(
    date.getFullYear(),
    date.getMonth() + monthOffset,
    1,
  );
}

const monthNavigationClassName =
  'rounded-full bg-white/8 text-[#aebac8] hover:bg-white/12 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';

function getGridGapClassName(touchCells: boolean): string {
  return touchCells ? 'gap-1 justify-items-center touch:gap-0' : 'gap-1';
}

function getDayToneClassName(isSelected: boolean, isToday: boolean): string {
  if (isSelected) {
    return 'bg-[#f0c38e] text-[#253241] shadow-sm shadow-[#f0c38e]/20';
  }

  return isToday
    ? 'bg-[#f0c38e]/12 text-[#f7d7ad] inset-ring-hairline inset-ring-[#f0c38e]/35 hover:bg-[#f0c38e]/20'
    : 'text-[#cbd5e0] hover:bg-white/[0.08] hover:text-[#fff9f2]';
}

function CalendarMonthHeader({
  monthDate,
  onMonthChange,
}: {
  monthDate: LocalDateString;
  onMonthChange: (monthDate: LocalDateString) => void;
}) {
  const { dictionary, locale } = useAppContext();
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <IconButton
        aria-label={dictionary.calendar.previousMonth}
        size="compact"
        className={monthNavigationClassName}
        onClick={() => onMonthChange(moveMonth(monthDate, -1))}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </IconButton>
      <span className="text-sm font-semibold capitalize text-[#fff9f2]">
        {monthFormatter.format(parseLocalDateKey(monthDate))}
      </span>
      <IconButton
        aria-label={dictionary.calendar.nextMonth}
        size="compact"
        className={monthNavigationClassName}
        onClick={() => onMonthChange(moveMonth(monthDate, 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </IconButton>
    </div>
  );
}

export function CalendarMonthPanel({
  monthDate,
  selectedDate,
  today,
  touchCells = false,
  onMonthChange,
  onSelectDate,
}: {
  monthDate: LocalDateString;
  selectedDate: LocalDateString | null;
  today: LocalDateString;
  touchCells?: boolean;
  onMonthChange: (monthDate: LocalDateString) => void;
  onSelectDate: (date: LocalDateString) => void;
}) {
  const { dictionary, locale } = useAppContext();
  const monthDays = useMemo(() => createMonthGrid(monthDate), [monthDate]);
  const monthNumber = parseLocalDateKey(monthDate).getMonth();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
      }),
    [locale],
  );
  const gridGapClassName = getGridGapClassName(touchCells);

  return (
    <>
      <CalendarMonthHeader
        monthDate={monthDate}
        onMonthChange={onMonthChange}
      />

      <div
        aria-hidden="true"
        className={`mt-2 grid grid-cols-7 text-center text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7b8da0] ${gridGapClassName}`}
      >
        {dictionary.calendar.weekdays.map((weekday) => (
          <span key={weekday} className="leading-8">
            {weekday}
          </span>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${gridGapClassName}`}>
        {monthDays.map((day) => {
          const dayDate = parseLocalDateKey(day.date);
          const isSelected = day.date === selectedDate;

          return (
            <button
              key={day.date}
              type="button"
              aria-label={dateFormatter.format(dayDate)}
              aria-pressed={isSelected}
              className={`inline-flex size-8 items-center justify-center rounded-full text-xs font-medium tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
                touchCells ? 'touch:size-11' : ''
              } ${getDayToneClassName(isSelected, day.date === today)} ${
                dayDate.getMonth() === monthNumber ? '' : 'opacity-35'
              }`}
              onClick={() => onSelectDate(day.date)}
            >
              {dayDate.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}
