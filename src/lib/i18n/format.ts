import type { SupportedLocale } from '@/lib/domain';

export function formatMonthLabel(
  date: Date,
  locale: SupportedLocale,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(date);
}

export function formatLocalDateLabel(
  date: Date,
  locale: SupportedLocale,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(date);
}
