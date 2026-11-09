import { describe, expect, it } from 'vitest';
import {
  computeRecurrencePerformance,
  getPerformanceRange,
  sortRecurrencePerformance,
  summarizeRecurrencePerformance,
  validatePerformanceRange,
  type LocalDateString,
  type Recurrence,
  type RecurrencePerformance,
  type RecurrenceResponse,
  type RecurrenceRule,
} from '@/lib/domain';

const daily: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};

function recurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    id: 'r1',
    scopeId: 'guest:test',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: '2026-01-01T12:00:00.000Z',
    text: 'Stretch',
    bold: false,
    priority: false,
    categoryTagId: null,
    children: [],
    schedule: [{ from: null, rule: daily }],
    contentHistory: [],
    ...overrides,
  };
}

function answer(
  date: LocalDateString,
  status: 'done' | 'not_done',
  overrides: Partial<RecurrenceResponse> = {},
): RecurrenceResponse {
  return {
    id: `${date}:${overrides.itemId ?? 'root'}`,
    scopeId: 'guest:test',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: '2026-01-01T12:00:00.000Z',
    recurrenceId: 'r1',
    date,
    itemId: null,
    status,
    ...overrides,
  };
}

function compute({
  createdDate = '2026-11-01',
  endDate = '2026-11-09',
  responses = [],
  startDate = '2026-11-01',
  subject = recurrence(),
  today = '2026-11-09',
}: {
  createdDate?: LocalDateString;
  endDate?: LocalDateString;
  responses?: RecurrenceResponse[];
  startDate?: LocalDateString;
  subject?: Recurrence;
  today?: LocalDateString;
} = {}) {
  return computeRecurrencePerformance({
    createdDate,
    endDate,
    recurrence: subject,
    responses,
    startDate,
    today,
  });
}

describe('computeRecurrencePerformance', () => {
  it('counts only explicit answers in the rate', () => {
    const result = compute({
      responses: [
        answer('2026-11-01', 'done'),
        answer('2026-11-02', 'done'),
        answer('2026-11-03', 'not_done'),
      ],
    });

    expect(result).toMatchObject({ done: 2, notDone: 1 });
    expect(result.rate).toBeCloseTo((2 / 3) * 100);
  });

  it('has no rate without answers instead of zero', () => {
    expect(compute().rate).toBeNull();
  });

  it('is zero when every answer was not done', () => {
    expect(
      compute({ responses: [answer('2026-11-02', 'not_done')] }).rate,
    ).toBe(0);
  });

  it('keeps past days without an answer apart from the rate', () => {
    const result = compute({
      responses: [answer('2026-11-01', 'done')],
    });

    expect(result).toMatchObject({
      done: 1,
      notDone: 0,
      unregistered: 7,
      pending: 1,
      rate: 100,
    });
    expect(result.coverage).toBeCloseTo((1 / 8) * 100);
  });

  it('treats today without an answer as pending and never counts the future', () => {
    const result = compute({ endDate: '2026-11-20', startDate: '2026-11-08' });

    expect(result).toMatchObject({ unregistered: 1, pending: 1 });
    expect(result.days.map((day) => day.date)).toEqual([
      '2026-11-08',
      '2026-11-09',
    ]);
  });

  it('counts today once answered', () => {
    expect(
      compute({
        startDate: '2026-11-09',
        responses: [answer('2026-11-09', 'done')],
      }),
    ).toMatchObject({ done: 1, pending: 0, unregistered: 0 });
  });

  it('only uses the dates the weekly rule predicts', () => {
    const result = compute({
      subject: recurrence({
        schedule: [
          {
            from: null,
            rule: {
              kind: 'weekly',
              everyWeeks: 1,
              weekdays: [1, 3, 5],
              anchorDate: null,
            },
          },
        ],
      }),
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      createdDate: '2026-10-01',
    });

    expect(result.days.map((day) => day.date)).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-06',
    ]);
    expect(result.unregistered).toBe(3);
  });

  it('starts at the creation date and never invents older gaps', () => {
    const result = compute({
      createdDate: '2026-11-05',
      startDate: '2026-10-01',
      endDate: '2026-11-08',
    });

    expect(result.days[0].date).toBe('2026-11-05');
    expect(result.unregistered).toBe(4);
  });

  it('starts at the first answer when it is older than the creation', () => {
    const result = compute({
      createdDate: '2026-11-05',
      startDate: '2026-10-01',
      endDate: '2026-11-08',
      responses: [answer('2026-11-03', 'done')],
    });

    expect(result.days[0]).toEqual({ date: '2026-11-03', status: 'done' });
    expect(result.unregistered).toBe(5);
  });

  it('respects pauses and rule changes over time', () => {
    const result = compute({
      createdDate: '2026-10-01',
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      subject: recurrence({
        schedule: [
          { from: null, rule: daily },
          { from: '2026-11-03', rule: null },
          {
            from: '2026-11-06',
            rule: { kind: 'monthly_day', day: 7 },
          },
        ],
      }),
    });

    expect(result.days.map((day) => day.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-07',
    ]);
  });

  it('keeps an answer the schedule no longer predicts', () => {
    const result = compute({
      subject: recurrence({ schedule: [{ from: null, rule: null }] }),
      responses: [answer('2026-11-04', 'not_done')],
    });

    expect(result.days).toEqual([{ date: '2026-11-04', status: 'not_done' }]);
    expect(result.unregistered).toBe(0);
  });

  it('ignores subtasks, answers returned to pending and other activities', () => {
    const result = compute({
      responses: [
        answer('2026-11-01', 'done', { itemId: 'child' }),
        answer('2026-11-02', 'done', {
          deletedAt: '2026-11-02T00:00:00.000Z',
        }),
        answer('2026-11-03', 'done', { recurrenceId: 'other' }),
        answer('2026-11-04', 'not_done'),
      ],
    });

    expect(result).toMatchObject({ done: 0, notDone: 1 });
  });

  it('handles the last day of months and leap years', () => {
    const result = compute({
      subject: recurrence({
        schedule: [{ from: null, rule: { kind: 'monthly_last_day' } }],
      }),
      createdDate: '2023-12-01',
      startDate: '2024-01-01',
      endDate: '2024-04-30',
      today: '2026-11-09',
    });

    expect(result.days.map((day) => day.date)).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
  });

  it('crosses years in the range', () => {
    const result = compute({
      subject: recurrence({
        schedule: [{ from: null, rule: { kind: 'monthly_day', day: 1 } }],
      }),
      createdDate: '2025-01-01',
      startDate: '2025-12-15',
      endDate: '2026-01-15',
    });

    expect(result.days.map((day) => day.date)).toEqual(['2026-01-01']);
  });

  it('is empty when the range ends before tracking starts', () => {
    expect(
      compute({ createdDate: '2026-11-05', endDate: '2026-11-04' }).days,
    ).toEqual([]);
  });
});

describe('summarizeRecurrencePerformance', () => {
  it('adds the activities without double counting', () => {
    const first = compute({ responses: [answer('2026-11-01', 'done')] });
    const second = compute({
      subject: recurrence({ id: 'r2' }),
      responses: [
        answer('2026-11-01', 'not_done', { recurrenceId: 'r2' }),
        answer('2026-11-02', 'done', { recurrenceId: 'r2' }),
      ],
    });

    const summary = summarizeRecurrencePerformance([first, second]);

    expect(summary).toMatchObject({
      done: 2,
      notDone: 1,
      unregistered: 13,
      pending: 2,
    });
    expect(summary.rate).toBeCloseTo((2 / 3) * 100);
  });

  it('has no rate or coverage for an empty list', () => {
    expect(summarizeRecurrencePerformance([])).toMatchObject({
      done: 0,
      rate: null,
      coverage: null,
    });
  });
});

describe('sortRecurrencePerformance', () => {
  const entry = (name: string, rate: number | null) => ({
    name,
    performance: { rate } as RecurrencePerformance,
  });
  const entries = [
    entry('beta', 50),
    entry('Alpha', null),
    entry('gamma', 90),
    entry('delta', 10),
  ];

  it('sorts by name', () => {
    expect(
      sortRecurrencePerformance(entries, 'name').map((item) => item.name),
    ).toEqual(['Alpha', 'beta', 'delta', 'gamma']);
  });

  it('keeps activities without results last in rate orders', () => {
    expect(
      sortRecurrencePerformance(entries, 'highest').map((item) => item.name),
    ).toEqual(['gamma', 'beta', 'delta', 'Alpha']);
    expect(
      sortRecurrencePerformance(entries, 'lowest').map((item) => item.name),
    ).toEqual(['delta', 'beta', 'gamma', 'Alpha']);
  });
});

describe('performance ranges', () => {
  it.each([
    [7, '2026-11-03'],
    [30, '2026-10-11'],
    [90, '2026-08-12'],
  ] as const)('includes today in the last %i days', (days, start) => {
    expect(getPerformanceRange(days, '2026-11-09')).toEqual({
      startDate: start,
      endDate: '2026-11-09',
    });
  });

  it('crosses a year boundary', () => {
    expect(getPerformanceRange(30, '2026-01-10')).toEqual({
      startDate: '2025-12-12',
      endDate: '2026-01-10',
    });
  });

  it.each([
    ['2026-11-01', '2026-11-01', null],
    ['2025-12-20', '2026-01-10', null],
    ['2026-11-10', '2026-11-01', 'order'],
    ['2026-02-31', '2026-03-01', 'invalid'],
    ['2026-11-01', '', 'invalid'],
  ])('validates %s to %s', (start, end, error) => {
    expect(validatePerformanceRange(start, end)).toBe(error);
  });
});
