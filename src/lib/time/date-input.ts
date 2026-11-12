import type { LocalDateString, SupportedLocale } from '@/lib/domain';
import {
  addLocalDays,
  createLocalDateKey,
  parseLocalDateKey,
} from './local-day';

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function createMaskedDateFromDigits(digits: string, separator: string): string {
  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}${separator}${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}${separator}${digits.slice(2, 4)}${separator}${digits.slice(4)}`;
}

export function maskDateInput(
  value: string,
  locale: SupportedLocale = 'pt-BR',
): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  return createMaskedDateFromDigits(digits, locale === 'en' ? '/' : '-');
}

export function formatDateInputValue(
  date: LocalDateString,
  locale: SupportedLocale = 'pt-BR',
): string {
  const [year, month, day] = date.split('-');

  return locale === 'en'
    ? `${month}/${day}/${year}`
    : `${day}-${month}-${year}`;
}

export function parseDateInputValue(
  value: string,
  locale: SupportedLocale = 'pt-BR',
): LocalDateString | null {
  const normalizedValue = maskDateInput(value, locale);

  if (!/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(normalizedValue)) {
    return null;
  }

  const { year, month, day } = getDateInputParts(normalizedValue, locale);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
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

export function formatShortDate(
  date: LocalDateString,
  locale: SupportedLocale,
): string {
  const [, month, day] = date.split('-');
  return locale === 'en' ? `${month}/${day}` : `${day}/${month}`;
}

function getDateInputParts(normalizedValue: string, locale: SupportedLocale) {
  const [firstPart, secondPart, yearPart] = normalizedValue.split(/[-/]/);
  const [monthPart, dayPart] =
    locale === 'en' ? [firstPart, secondPart] : [secondPart, firstPart];
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  return { year, month, day };
}
