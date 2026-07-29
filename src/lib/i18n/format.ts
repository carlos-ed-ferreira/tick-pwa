import type { SupportedLocale } from '@/lib/domain';

export function formatCountLabel({
  count,
  plural,
  singular,
}: {
  count: number;
  plural: string;
  singular: string;
}): string {
  return (count === 1 ? singular : plural).replace('{count}', String(count));
}

export const formatSelectionLabel = formatCountLabel;

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
