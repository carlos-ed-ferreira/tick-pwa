import {
  getContentAt,
  getRuleAt,
  isCalendarDate,
  matchesRule,
} from './recurrence';
import {
  getQuantityOutcome,
  summarizeQuantities,
  type RecurrenceQuantitySummary,
} from './recurrence-quantity';
import type {
  LocalDateString,
  Recurrence,
  RecurrenceQuantity,
  RecurrenceResponse,
  RecurrenceResponseStatus,
} from './types';

export type RecurrencePerformanceStatus =
  | RecurrenceResponseStatus
  | 'partial'
  | 'unregistered'
  | 'pending';

export interface RecurrencePerformanceDay {
  date: LocalDateString;
  quantity: RecurrenceQuantity | null;
  status: RecurrencePerformanceStatus;
}

export interface RecurrencePerformanceTotals {
  coverage: number | null;
  done: number;
  notDone: number;
  partial: number;
  pending: number;
  rate: number | null;
  unregistered: number;
}

export interface RecurrencePerformance extends RecurrencePerformanceTotals {
  days: RecurrencePerformanceDay[];
  quantities: RecurrenceQuantitySummary[];
}

type PerformanceCounts = Omit<RecurrencePerformanceTotals, 'coverage' | 'rate'>;

interface RecordedAnswer {
  quantity: RecurrenceQuantity | null;
  status: RecurrenceResponseStatus;
}

const countKeys: Record<RecurrencePerformanceStatus, keyof PerformanceCounts> =
  {
    done: 'done',
    not_done: 'notDone',
    partial: 'partial',
    pending: 'pending',
    unregistered: 'unregistered',
  };

function emptyCounts(): PerformanceCounts {
  return { done: 0, notDone: 0, partial: 0, pending: 0, unregistered: 0 };
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

function withRatios(totals: PerformanceCounts): RecurrencePerformanceTotals {
  const answered = totals.done + totals.notDone + totals.partial;

  return {
    ...totals,
    coverage: percent(answered, answered + totals.unregistered),
    rate: percent(totals.done, answered),
  };
}

function getItemAnswers(
  recurrence: Recurrence,
  itemId: string | null,
  responses: readonly RecurrenceResponse[],
): Map<LocalDateString, RecordedAnswer> {
  const answers = new Map<LocalDateString, RecordedAnswer>();

  for (const response of responses) {
    if (
      response.recurrenceId === recurrence.id &&
      response.itemId === itemId &&
      response.deletedAt === null
    ) {
      answers.set(response.date, {
        quantity: response.quantity ?? null,
        status: response.status,
      });
    }
  }

  return answers;
}

function getAnswerStatus(answer: RecordedAnswer): RecurrencePerformanceStatus {
  if (!answer.quantity) {
    return answer.status;
  }

  const outcome = getQuantityOutcome(answer.quantity);

  if (outcome === 'zero') {
    return 'not_done';
  }

  return outcome;
}

function itemExistsOn(
  recurrence: Recurrence,
  itemId: string | null,
  date: LocalDateString,
): boolean {
  return (
    itemId === null ||
    getContentAt(recurrence, date).children.some((child) => child.id === itemId)
  );
}

function getDayStatus({
  answer,
  date,
  itemId,
  recurrence,
  today,
}: {
  answer: RecordedAnswer | undefined;
  date: LocalDateString;
  itemId: string | null;
  recurrence: Recurrence;
  today: LocalDateString;
}): RecurrencePerformanceStatus | null {
  if (answer) {
    return getAnswerStatus(answer);
  }

  const rule = getRuleAt(recurrence.schedule, date);

  if (
    !rule ||
    !matchesRule(rule, date) ||
    !itemExistsOn(recurrence, itemId, date)
  ) {
    return null;
  }

  return date === today ? 'pending' : 'unregistered';
}

export function computeRecurrencePerformance({
  createdDate,
  endDate,
  itemId = null,
  recurrence,
  responses,
  startDate,
  today,
}: {
  createdDate: LocalDateString;
  endDate: LocalDateString;
  itemId?: string | null;
  recurrence: Recurrence;
  responses: readonly RecurrenceResponse[];
  startDate: LocalDateString;
  today: LocalDateString;
}): RecurrencePerformance {
  const answers = getItemAnswers(recurrence, itemId, responses);
  const trackingStart = [...answers.keys()].reduce(earlierDate, createdDate);
  const first = toDayNumber(laterDate(startDate, trackingStart));
  const last = toDayNumber(earlierDate(endDate, today));
  const days: RecurrencePerformanceDay[] = [];
  const totals = emptyCounts();

  for (let dayNumber = first; dayNumber <= last; dayNumber += 1) {
    const date = toDate(dayNumber);
    const answer = answers.get(date);
    const status = getDayStatus({ answer, date, itemId, recurrence, today });

    if (status) {
      days.push({ date, quantity: answer?.quantity ?? null, status });
      totals[countKeys[status]] += 1;
    }
  }

  return {
    ...withRatios(totals),
    days,
    quantities: summarizeQuantities(
      days.flatMap((day) => (day.quantity ? [day.quantity] : [])),
    ),
  };
}

export function summarizeRecurrencePerformance(
  performances: readonly RecurrencePerformance[],
): RecurrencePerformanceTotals {
  const totals = emptyCounts();

  for (const performance of performances) {
    for (const key of Object.keys(totals) as (keyof PerformanceCounts)[]) {
      totals[key] += performance[key];
    }
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

export type RecurrenceCalendarStatus =
  | RecurrencePerformanceStatus
  | 'future'
  | 'none'
  | 'outside';

function isScheduledOn(recurrence: Recurrence, date: LocalDateString) {
  const rule = getRuleAt(recurrence.schedule, date);

  return Boolean(rule && matchesRule(rule, date));
}

function getCalendarStatus({
  date,
  range,
  recurrence,
  statusByDate,
  today,
}: {
  date: LocalDateString;
  range: { endDate: LocalDateString; startDate: LocalDateString };
  recurrence: Recurrence;
  statusByDate: Map<LocalDateString, RecurrencePerformanceStatus>;
  today: LocalDateString;
}): RecurrenceCalendarStatus {
  if (date < range.startDate || date > range.endDate) {
    return 'outside';
  }

  const status = statusByDate.get(date);

  if (status) {
    return status;
  }

  return date > today && isScheduledOn(recurrence, date) ? 'future' : 'none';
}

export function getRecurrenceCalendarStatuses({
  dates,
  performance,
  range,
  recurrence,
  today,
}: {
  dates: readonly LocalDateString[];
  performance: Pick<RecurrencePerformance, 'days'>;
  range: { endDate: LocalDateString; startDate: LocalDateString };
  recurrence: Recurrence;
  today: LocalDateString;
}): Map<LocalDateString, RecurrenceCalendarStatus> {
  const statusByDate = new Map(
    performance.days.map((day) => [day.date, day.status]),
  );

  return new Map(
    dates.map((date) => [
      date,
      getCalendarStatus({ date, range, recurrence, statusByDate, today }),
    ]),
  );
}

export function getPerformanceMonths(
  startDate: LocalDateString,
  endDate: LocalDateString,
): LocalDateString[] {
  const months: LocalDateString[] = [];
  let [year, month] = startDate.split('-').map(Number);
  const last = endDate.slice(0, 7);

  while (`${year}-${String(month).padStart(2, '0')}` <= last) {
    months.push(
      `${year}-${String(month).padStart(2, '0')}-01` as LocalDateString,
    );
    year += Math.floor(month / 12);
    month = (month % 12) + 1;
  }

  return months;
}
