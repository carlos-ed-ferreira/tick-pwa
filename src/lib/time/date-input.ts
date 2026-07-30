import type { LocalDateString } from '@/lib/domain';
import {
  addLocalDays,
  createLocalDateKey,
  parseLocalDateKey,
} from './local-day';

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function createMaskedDateFromDigits(digits: string): string {
  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  return createMaskedDateFromDigits(digits);
}

export function formatDateInputValue(date: LocalDateString): string {
  const [year, month, day] = date.split('-');

  return `${day}-${month}-${year}`;
}

export function parseDateInputValue(value: string): LocalDateString | null {
  const normalizedValue = maskDateInput(value);

  if (!/^\d{2}-\d{2}-\d{4}$/.test(normalizedValue)) {
    return null;
  }

  const [dayPart, monthPart, yearPart] = normalizedValue.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const localDate = createLocalDateKey(year, month - 1, day);
  const parsedDate = parseLocalDateKey(localDate);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return localDate;
}

export function getLocalDateWeekday(date: LocalDateString): WeekdayIndex {
  return parseLocalDateKey(date).getDay() as WeekdayIndex;
}

export function getDatesInRangeForWeekdays({
  endDate,
  selectedWeekdays,
  startDate,
}: {
  endDate: LocalDateString;
  selectedWeekdays: readonly WeekdayIndex[];
  startDate: LocalDateString;
}): LocalDateString[] {
  if (startDate > endDate) {
    return [];
  }

  const selectedWeekdaySet = new Set<WeekdayIndex>(
    selectedWeekdays.length > 0
      ? selectedWeekdays
      : ([0, 1, 2, 3, 4, 5, 6] satisfies WeekdayIndex[]),
  );
  const dates: LocalDateString[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    if (selectedWeekdaySet.has(getLocalDateWeekday(cursor))) {
      dates.push(cursor);
    }

    cursor = addLocalDays(cursor, 1);
  }

  return dates;
}
