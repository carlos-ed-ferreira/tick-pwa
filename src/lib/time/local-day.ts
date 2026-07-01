import type { LocalDateString } from '@/lib/domain';

const localDateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getLocalDateFormatter(timezone: string): Intl.DateTimeFormat {
  const existingFormatter = localDateFormatterCache.get(timezone);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    calendar: 'iso8601',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });

  localDateFormatterCache.set(timezone, formatter);
  return formatter;
}

export function toLocalDateKey(date: Date, timezone: string): LocalDateString {
  return getLocalDateFormatter(timezone).format(date) as LocalDateString;
}

export function getTodayKey(timezone: string): LocalDateString {
  return toLocalDateKey(new Date(), timezone);
}

export function isLocalDateString(value: string): value is LocalDateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseLocalDateKey(dateKey: LocalDateString): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function createLocalDateKey(
  year: number,
  monthIndex: number,
  day: number,
): LocalDateString {
  const normalizedDate = new Date(year, monthIndex, day);
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const date = String(normalizedDate.getDate()).padStart(2, '0');

  return `${normalizedDate.getFullYear()}-${month}-${date}` as LocalDateString;
}

export function addLocalDays(
  dateKey: LocalDateString,
  days: number,
): LocalDateString {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + days);

  return createLocalDateKey(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

export function getMonthRange(dateKey: LocalDateString): {
  startDate: LocalDateString;
  endDate: LocalDateString;
} {
  const date = parseLocalDateKey(dateKey);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startDate = createLocalDateKey(date.getFullYear(), date.getMonth(), 1);
  const endDate = createLocalDateKey(
    endOfMonth.getFullYear(),
    endOfMonth.getMonth(),
    endOfMonth.getDate(),
  );

  return { startDate, endDate };
}

export interface CalendarDay {
  date: LocalDateString;
  inCurrentMonth: boolean;
}

export function createMonthGrid(monthDateKey: LocalDateString): CalendarDay[] {
  const monthDate = parseLocalDateKey(monthDateKey);
  const firstOfMonth = createLocalDateKey(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  );
  const { endDate } = getMonthRange(monthDateKey);
  const leadingDays = parseLocalDateKey(firstOfMonth).getDay();
  const trailingTarget = 42;
  const days: CalendarDay[] = [];
  let cursor = addLocalDays(firstOfMonth, -leadingDays);

  while (days.length < trailingTarget) {
    const cursorDate = parseLocalDateKey(cursor);
    days.push({
      date: cursor,
      inCurrentMonth: cursorDate.getMonth() === monthDate.getMonth(),
    });
    cursor = addLocalDays(cursor, 1);
  }

  const finalVisibleDate = days[days.length - 1]?.date;

  if (finalVisibleDate && finalVisibleDate < endDate) {
    while (days[days.length - 1]?.date !== endDate) {
      const nextDate = addLocalDays(days[days.length - 1].date, 1);
      days.push({ date: nextDate, inCurrentMonth: true });
    }
  }

  return days;
}

export function getVisibleMonthGridRange(monthDateKey: LocalDateString): {
  startDate: LocalDateString;
  endDate: LocalDateString;
} {
  const monthGrid = createMonthGrid(monthDateKey);
  const startDate = monthGrid[0]?.date ?? monthDateKey;
  const endDate = monthGrid[monthGrid.length - 1]?.date ?? monthDateKey;

  return { startDate, endDate };
}
