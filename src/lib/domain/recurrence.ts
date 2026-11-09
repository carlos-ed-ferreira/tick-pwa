import type {
  AppScopeId,
  LocalDateString,
  Recurrence,
  RecurrenceContent,
  RecurrenceOccurrence,
  RecurrenceResponse,
  RecurrenceResponseStatus,
  RecurrenceRule,
  RecurrenceScheduleSegment,
} from './types';

export type RecurrenceRuleError =
  | 'kind'
  | 'interval'
  | 'anchor'
  | 'weekdays'
  | 'day'
  | 'position';

const MILLISECONDS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const MAX_DAY_OF_MONTH = 31;
const MAX_WEEK_ORDINAL = 4;

function parseDateParts(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);

  return [year, month, day];
}

export function isCalendarDate(value: unknown): value is LocalDateString {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = parseDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toDayNumber(date: LocalDateString): number {
  const [year, month, day] = parseDateParts(date);

  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY;
}

function getWeekday(dayNumber: number): number {
  return new Date(dayNumber * MILLISECONDS_PER_DAY).getUTCDay();
}

function getDaysInMonth(date: LocalDateString): number {
  const [year, month] = parseDateParts(date);

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isWeekday(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

function validateIntervalRule(
  rule: Record<string, unknown>,
): RecurrenceRuleError | null {
  if (!isPositiveInteger(rule.everyDays)) {
    return 'interval';
  }

  return isCalendarDate(rule.anchorDate) ? null : 'anchor';
}

function validateWeeklyRule(
  rule: Record<string, unknown>,
): RecurrenceRuleError | null {
  if (!isPositiveInteger(rule.everyWeeks)) {
    return 'interval';
  }

  if (
    !Array.isArray(rule.weekdays) ||
    rule.weekdays.length === 0 ||
    !rule.weekdays.every(isWeekday)
  ) {
    return 'weekdays';
  }

  const needsAnchor = rule.everyWeeks > 1;

  return needsAnchor && !isCalendarDate(rule.anchorDate) ? 'anchor' : null;
}

function validateMonthlyDayRule(
  rule: Record<string, unknown>,
): RecurrenceRuleError | null {
  return isPositiveInteger(rule.day) && rule.day <= MAX_DAY_OF_MONTH
    ? null
    : 'day';
}

function validateMonthlyWeekdayRule(
  rule: Record<string, unknown>,
): RecurrenceRuleError | null {
  const isOrdinalValid =
    rule.ordinal === 'last' ||
    (isPositiveInteger(rule.ordinal) && rule.ordinal <= MAX_WEEK_ORDINAL);

  return isOrdinalValid && isWeekday(rule.weekday) ? null : 'position';
}

export function validateRecurrenceRule(
  rule: unknown,
): RecurrenceRuleError | null {
  if (typeof rule !== 'object' || rule === null) {
    return 'kind';
  }

  const candidate = rule as Record<string, unknown>;

  switch (candidate.kind) {
    case 'interval':
      return validateIntervalRule(candidate);
    case 'weekly':
      return validateWeeklyRule(candidate);
    case 'monthly_day':
      return validateMonthlyDayRule(candidate);
    case 'monthly_last_day':
      return null;
    case 'monthly_weekday':
      return validateMonthlyWeekdayRule(candidate);
    default:
      return 'kind';
  }
}

function matchesWeeklyRule(
  rule: Extract<RecurrenceRule, { kind: 'weekly' }>,
  date: LocalDateString,
): boolean {
  const dayNumber = toDayNumber(date);
  const weekday = getWeekday(dayNumber);

  if (!rule.weekdays.includes(weekday as never)) {
    return false;
  }

  if (rule.everyWeeks === 1 || !rule.anchorDate) {
    return true;
  }

  const anchorDayNumber = toDayNumber(rule.anchorDate);
  const anchorWeekStart = anchorDayNumber - getWeekday(anchorDayNumber);
  const weekStart = dayNumber - weekday;
  const weeksFromAnchor = (weekStart - anchorWeekStart) / DAYS_PER_WEEK;

  return weeksFromAnchor % rule.everyWeeks === 0;
}

function matchesMonthlyWeekdayRule(
  rule: Extract<RecurrenceRule, { kind: 'monthly_weekday' }>,
  date: LocalDateString,
): boolean {
  if (getWeekday(toDayNumber(date)) !== rule.weekday) {
    return false;
  }

  const [, , day] = parseDateParts(date);

  return rule.ordinal === 'last'
    ? day + DAYS_PER_WEEK > getDaysInMonth(date)
    : Math.ceil(day / DAYS_PER_WEEK) === rule.ordinal;
}

export function matchesRule(
  rule: RecurrenceRule,
  date: LocalDateString,
): boolean {
  if (validateRecurrenceRule(rule) !== null || !isCalendarDate(date)) {
    return false;
  }

  switch (rule.kind) {
    case 'interval':
      return (
        (toDayNumber(date) - toDayNumber(rule.anchorDate)) % rule.everyDays ===
        0
      );
    case 'weekly':
      return matchesWeeklyRule(rule, date);
    case 'monthly_day':
      return parseDateParts(date)[2] === rule.day;
    case 'monthly_last_day':
      return parseDateParts(date)[2] === getDaysInMonth(date);
    case 'monthly_weekday':
      return matchesMonthlyWeekdayRule(rule, date);
  }
}

function createRuleKey(rule: RecurrenceRule | null): string {
  if (!rule) {
    return 'paused';
  }

  switch (rule.kind) {
    case 'interval':
      return `interval:${rule.everyDays}:${rule.anchorDate}`;
    case 'weekly':
      return `weekly:${rule.everyWeeks}:${[...rule.weekdays].sort().join()}:${rule.anchorDate}`;
    case 'monthly_day':
      return `monthly_day:${rule.day}`;
    case 'monthly_last_day':
      return 'monthly_last_day';
    case 'monthly_weekday':
      return `monthly_weekday:${rule.ordinal}:${rule.weekday}`;
  }
}

export function getRuleAt(
  schedule: readonly RecurrenceScheduleSegment[],
  date: LocalDateString,
): RecurrenceRule | null {
  if (!Array.isArray(schedule)) {
    return null;
  }

  let currentRule: RecurrenceRule | null = null;
  let currentFrom = '';

  for (const segment of schedule as readonly RecurrenceScheduleSegment[]) {
    const from = segment?.from ?? '';

    if (from <= date && from >= currentFrom) {
      currentFrom = from;
      currentRule = segment?.rule ?? null;
    }
  }

  return currentRule;
}

export function appendScheduleSegment(
  schedule: readonly RecurrenceScheduleSegment[],
  from: LocalDateString,
  rule: RecurrenceRule | null,
): RecurrenceScheduleSegment[] {
  const replacesSameDay = schedule.at(-1)?.from === from;
  const previous = replacesSameDay ? schedule.slice(0, -1) : [...schedule];
  const lastSegment = previous.at(-1);

  if (lastSegment && createRuleKey(lastSegment.rule) === createRuleKey(rule)) {
    return replacesSameDay
      ? previous
      : (schedule as RecurrenceScheduleSegment[]);
  }

  return [...previous, { from, rule }];
}

export function isRecurrencePaused(
  schedule: readonly RecurrenceScheduleSegment[],
): boolean {
  return Array.isArray(schedule) && schedule.at(-1)?.rule === null;
}

export function getLatestRule(
  schedule: readonly RecurrenceScheduleSegment[],
): RecurrenceRule | null {
  if (!Array.isArray(schedule)) {
    return null;
  }

  const activeSegments = (
    schedule as readonly RecurrenceScheduleSegment[]
  ).filter((segment) => segment?.rule);

  return activeSegments.at(-1)?.rule ?? null;
}

export function pauseSchedule(
  schedule: readonly RecurrenceScheduleSegment[],
  from: LocalDateString,
): RecurrenceScheduleSegment[] {
  return appendScheduleSegment(schedule, from, null);
}

export function resumeSchedule(
  schedule: readonly RecurrenceScheduleSegment[],
  from: LocalDateString,
): RecurrenceScheduleSegment[] {
  const latestRule = getLatestRule(schedule);

  return latestRule
    ? appendScheduleSegment(schedule, from, latestRule)
    : [...schedule];
}

export function pickRecurrenceContent(
  content: RecurrenceContent,
): RecurrenceContent {
  return {
    text: content.text,
    bold: content.bold,
    priority: content.priority,
    categoryTagId: content.categoryTagId,
    children: content.children,
  };
}

export function isSameRecurrenceContent(
  left: RecurrenceContent,
  right: RecurrenceContent,
): boolean {
  return (
    JSON.stringify(pickRecurrenceContent(left)) ===
    JSON.stringify(pickRecurrenceContent(right))
  );
}

export function getContentAt(
  recurrence: Recurrence,
  date: LocalDateString,
): RecurrenceContent {
  const history = Array.isArray(recurrence.contentHistory)
    ? recurrence.contentHistory
    : [];
  const applicable = history
    .filter((snapshot) => snapshot.until > date)
    .sort((left, right) => left.until.localeCompare(right.until))[0];

  return pickRecurrenceContent(applicable ?? recurrence);
}

export function replaceContentForward(
  recurrence: Recurrence,
  content: RecurrenceContent,
  until: LocalDateString,
): Recurrence {
  const alreadyCut = recurrence.contentHistory.some(
    (snapshot) => snapshot.until === until,
  );
  const contentHistory = alreadyCut
    ? recurrence.contentHistory
    : [
        ...recurrence.contentHistory,
        { ...pickRecurrenceContent(recurrence), until },
      ];

  return { ...recurrence, ...content, contentHistory };
}

function compareByCreation(left: Recurrence, right: Recurrence): number {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function getOccurrencesForDate({
  date,
  recurrences,
  responses,
}: {
  date: LocalDateString;
  recurrences: readonly Recurrence[];
  responses: readonly RecurrenceResponse[];
}): RecurrenceOccurrence[] {
  const activeResponses = responses.filter(
    (response) => response.date === date && response.deletedAt === null,
  );

  return recurrences
    .filter((recurrence) => recurrence.deletedAt === null)
    .sort(compareByCreation)
    .flatMap((recurrence) => {
      const ownResponses = activeResponses.filter(
        (response) => response.recurrenceId === recurrence.id,
      );
      const status =
        ownResponses.find((response) => response.itemId === null)?.status ??
        null;
      const rule = getRuleAt(recurrence.schedule, date);
      const isScheduled = rule !== null && matchesRule(rule, date);

      if (!isScheduled && status === null) {
        return [];
      }

      const childStatuses: Record<string, RecurrenceResponseStatus> = {};

      for (const response of ownResponses) {
        if (response.itemId !== null) {
          childStatuses[response.itemId] = response.status;
        }
      }

      return [
        {
          recurrence,
          content: getContentAt(recurrence, date),
          date,
          status,
          childStatuses,
        },
      ];
    });
}

export function canRespondOnDate(
  date: LocalDateString,
  today: LocalDateString,
): boolean {
  return isCalendarDate(date) && date <= today;
}

export function buildRecurrenceResponseId({
  date,
  itemId,
  recurrenceId,
  scopeId,
}: {
  date: LocalDateString;
  itemId: string | null;
  recurrenceId: string;
  scopeId: AppScopeId;
}): string {
  return `rr:${scopeId}:${recurrenceId}:${date}:${itemId ?? 'root'}`;
}
