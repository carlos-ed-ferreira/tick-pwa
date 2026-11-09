import {
  getLatestRule,
  type LocalDateString,
  type Recurrence,
  type RecurrenceRule,
} from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n/dictionaries';

function formatWeekdayList(
  weekdays: readonly number[],
  dictionary: Dictionary,
): string {
  return [...weekdays]
    .sort()
    .map((weekday) => dictionary.calendar.weekdays[weekday])
    .join(', ');
}

export function formatRecurrenceRule(
  rule: RecurrenceRule,
  dictionary: Dictionary,
): string {
  const labels = dictionary.recurring;

  switch (rule.kind) {
    case 'interval':
      return rule.everyDays === 1
        ? labels.everyDay
        : labels.everyDays.replace('{count}', String(rule.everyDays));
    case 'weekly': {
      const days = formatWeekdayList(rule.weekdays, dictionary);

      return rule.everyWeeks === 1
        ? labels.everyWeek.replace('{days}', days)
        : labels.everyWeeks
            .replace('{count}', String(rule.everyWeeks))
            .replace('{days}', days);
    }
    case 'monthly_day':
      return labels.monthlyOnDay.replace('{day}', String(rule.day));
    case 'monthly_last_day':
      return labels.monthlyOnLastDay;
    case 'monthly_weekday': {
      const form = labels.weekdayOrdinalForms[rule.weekday];

      return labels.monthlyOnWeekday
        .replace('{ordinal}', labels.ordinals[rule.ordinal][form])
        .replace('{weekday}', labels.weekdayNames[rule.weekday]);
    }
  }
}

export function formatRecurrenceFrequency(
  recurrence: Pick<Recurrence, 'schedule'>,
  dictionary: Dictionary,
): string {
  const rule = getLatestRule(recurrence.schedule);

  return rule ? formatRecurrenceRule(rule, dictionary) : '';
}

export function formatRecurringDate(
  date: LocalDateString,
  locale: string,
): string {
  const [year, month, day] = date.split('-').map(Number);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
