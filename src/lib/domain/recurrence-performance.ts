import { getRuleAt, isCalendarDate, matchesRule } from './recurrence';
import type {
  LocalDateString,
  Recurrence,
  RecurrenceResponse,
  RecurrenceResponseStatus,
} from './types';

export type RecurrencePerformanceStatus =
  | RecurrenceResponseStatus
  | 'unregistered'
  | 'pending';

export interface RecurrencePerformanceDay {
  date: LocalDateString;
  status: RecurrencePerformanceStatus;
}

export interface RecurrencePerformanceTotals {
  coverage: number | null;
  done: number;
  notDone: number;
  pending: number;
  rate: number | null;
  unregistered: number;
}

export interface RecurrencePerformance extends RecurrencePerformanceTotals {
  days: RecurrencePerformanceDay[];
}

export type RecurrencePerformanceSort = 'name' | 'highest' | 'lowest';

export type PerformanceRangeError = 'invalid' | 'order';

const MILLISECONDS_PER_DAY = 86_400_000;

function toDate(dayNumber: number): LocalDateString {
  return new Date(dayNumber * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10) as LocalDateString;
}

function toDayNumber(date: LocalDateString): number {
  const [year, month, day] = date.split('-').map(Number);

  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY;
}

function laterDate(left: LocalDateString, right: LocalDateString) {
  return left > right ? left : right;
}

function earlierDate(left: LocalDateString, right: LocalDateString) {
  return left < right ? left : right;
}

function percent(part: number, total: number): number | null {
  return total === 0 ? null : (part / total) * 100;
}

function withRatios(
  totals: Omit<RecurrencePerformanceTotals, 'coverage' | 'rate'>,
): RecurrencePerformanceTotals {
  const answered = totals.done + totals.notDone;

  return {
    ...totals,
    coverage: percent(answered, answered + totals.unregistered),
    rate: percent(totals.done, answered),
  };
}

function getRootAnswers(
  recurrence: Recurrence,
  responses: readonly RecurrenceResponse[],
): Map<LocalDateString, RecurrenceResponseStatus> {
  const answers = new Map<LocalDateString, RecurrenceResponseStatus>();

  for (const response of responses) {
    if (
      response.recurrenceId === recurrence.id &&
      response.itemId === null &&
      response.deletedAt === null
    ) {
      answers.set(response.date, response.status);
    }
  }

  return answers;
}

function getDayStatus({
  answer,
  date,
  recurrence,
  today,
}: {
  answer: RecurrenceResponseStatus | undefined;
  date: LocalDateString;
  recurrence: Recurrence;
  today: LocalDateString;
}): RecurrencePerformanceStatus | null {
  if (answer) {
    return answer;
  }

  const rule = getRuleAt(recurrence.schedule, date);

  if (!rule || !matchesRule(rule, date)) {
    return null;
  }

  return date === today ? 'pending' : 'unregistered';
}

export function computeRecurrencePerformance({
  createdDate,
  endDate,
  recurrence,
  responses,
  startDate,
  today,
}: {
  createdDate: LocalDateString;
  endDate: LocalDateString;
  recurrence: Recurrence;
  responses: readonly RecurrenceResponse[];
  startDate: LocalDateString;
  today: LocalDateString;
}): RecurrencePerformance {
  const answers = getRootAnswers(recurrence, responses);
  const trackingStart = [...answers.keys()].reduce(earlierDate, createdDate);
  const first = toDayNumber(laterDate(startDate, trackingStart));
  const last = toDayNumber(earlierDate(endDate, today));
  const days: RecurrencePerformanceDay[] = [];
  const totals = { done: 0, notDone: 0, pending: 0, unregistered: 0 };

  for (let dayNumber = first; dayNumber <= last; dayNumber += 1) {
    const date = toDate(dayNumber);
    const status = getDayStatus({
      answer: answers.get(date),
      date,
      recurrence,
      today,
    });

    if (status) {
      days.push({ date, status });
      totals[status === 'not_done' ? 'notDone' : status] += 1;
    }
  }

  return { ...withRatios(totals), days };
}

export function summarizeRecurrencePerformance(
  performances: readonly RecurrencePerformance[],
): RecurrencePerformanceTotals {
  const totals = { done: 0, notDone: 0, pending: 0, unregistered: 0 };

  for (const performance of performances) {
    totals.done += performance.done;
    totals.notDone += performance.notDone;
    totals.pending += performance.pending;
    totals.unregistered += performance.unregistered;
  }

  return withRatios(totals);
}

export function sortRecurrencePerformance<
  T extends { name: string; performance: Pick<RecurrencePerformance, 'rate'> },
>(entries: readonly T[], sort: RecurrencePerformanceSort): T[] {
  const byName = (left: T, right: T) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });

  if (sort === 'name') {
    return [...entries].sort(byName);
  }

  const direction = sort === 'highest' ? -1 : 1;

  return [...entries].sort((left, right) => {
    const leftRate = left.performance.rate;
    const rightRate = right.performance.rate;

    if (leftRate === null || rightRate === null) {
      return Number(leftRate === null) - Number(rightRate === null);
    }

    return direction * (leftRate - rightRate) || byName(left, right);
  });
}

export function getPerformanceRange(
  days: number,
  today: LocalDateString,
): { endDate: LocalDateString; startDate: LocalDateString } {
  return {
    endDate: today,
    startDate: toDate(toDayNumber(today) - (days - 1)),
  };
}

export function validatePerformanceRange(
  startDate: string,
  endDate: string,
): PerformanceRangeError | null {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) {
    return 'invalid';
  }

  return startDate > endDate ? 'order' : null;
}
