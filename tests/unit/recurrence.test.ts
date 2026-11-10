import { describe, expect, it } from 'vitest';
import {
  appendScheduleSegment,
  buildRecurrenceResponseId,
  canRespondOnDate,
  getContentAt,
  getLatestRule,
  getOccurrencesForDate,
  getRuleAt,
  isCalendarDate,
  isRecurrencePaused,
  isSameRecurrenceContent,
  matchesRule,
  pauseSchedule,
  replaceContentForward,
  resumeSchedule,
  validateRecurrenceRule,
  type LocalDateString,
  type Recurrence,
  type RecurrenceChild,
  type RecurrenceContent,
  type RecurrenceResponse,
  type RecurrenceRule,
} from '@/lib/domain';

const daily: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};

const biweekly: RecurrenceRule = {
  kind: 'weekly',
  everyWeeks: 2,
  weekdays: [1, 3, 5],
  anchorDate: '2026-11-02',
};

function createRecurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    id: 'recurrence-1',
    scopeId: 'guest:test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: '2026-01-01T00:00:00.000Z',
    text: 'Current',
    bold: false,
    priority: false,
    categoryTagId: null,
    children: [],
    schedule: [{ from: null, rule: daily }],
    contentHistory: [],
    ...overrides,
  };
}

function createResponse(
  overrides: Partial<RecurrenceResponse> = {},
): RecurrenceResponse {
  return {
    id: 'response-1',
    scopeId: 'guest:test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: '2026-01-01T00:00:00.000Z',
    recurrenceId: 'recurrence-1',
    date: '2026-11-06',
    itemId: null,
    status: 'done',
    ...overrides,
  };
}

function matchingDates(
  rule: RecurrenceRule,
  dates: LocalDateString[],
): LocalDateString[] {
  return dates.filter((date) => matchesRule(rule, date));
}

describe('isCalendarDate', () => {
  it('rejects shapes the regex helper accepts but the calendar does not have', () => {
    expect(isCalendarDate('2026-11-06')).toBe(true);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-99-99')).toBe(false);
    expect(isCalendarDate('06-11-2026')).toBe(false);
  });

  it('rejects trailing content and values that are not text', () => {
    expect(isCalendarDate('2026-11-06T12:00')).toBe(false);
    expect(isCalendarDate(20261106)).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
  });
});

describe('matchesRule', () => {
  describe('interval', () => {
    const everyFifteen: RecurrenceRule = {
      kind: 'interval',
      everyDays: 15,
      anchorDate: '2026-11-01',
    };

    it('matches the anchor and each cycle after it', () => {
      expect(
        matchingDates(everyFifteen, [
          '2026-11-01',
          '2026-11-02',
          '2026-11-15',
          '2026-11-16',
          '2026-12-01',
        ]),
      ).toEqual(['2026-11-01', '2026-11-16', '2026-12-01']);
    });

    it('matches cycles before the anchor without a start date', () => {
      expect(
        matchingDates(everyFifteen, ['2026-10-17', '2026-10-18', '2026-10-02']),
      ).toEqual(['2026-10-17', '2026-10-02']);
    });

    it('keeps the cycle across the daylight saving changes', () => {
      const everyWeek: RecurrenceRule = {
        kind: 'interval',
        everyDays: 7,
        anchorDate: '2026-03-01',
      };

      expect(matchesRule(everyWeek, '2026-03-08')).toBe(true);
      expect(matchesRule(everyWeek, '2026-03-29')).toBe(true);
      expect(matchesRule(everyWeek, '2026-11-01')).toBe(true);
    });
  });

  describe('weekly', () => {
    it('matches the selected weekdays every week', () => {
      const rule: RecurrenceRule = {
        kind: 'weekly',
        everyWeeks: 1,
        weekdays: [1, 5],
        anchorDate: null,
      };

      expect(
        matchingDates(rule, [
          '2026-11-01',
          '2026-11-02',
          '2026-11-03',
          '2026-11-06',
        ]),
      ).toEqual(['2026-11-02', '2026-11-06']);
    });

    it('only matches the weeks that belong to the cycle', () => {
      expect(
        matchingDates(biweekly, [
          '2026-11-02',
          '2026-11-04',
          '2026-11-06',
          '2026-11-09',
          '2026-11-11',
          '2026-11-16',
        ]),
      ).toEqual(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-16']);
    });

    it('resolves the cycle from the week of the anchor, starting on Sunday', () => {
      const anchoredOnSaturday: RecurrenceRule = {
        kind: 'weekly',
        everyWeeks: 2,
        weekdays: [0],
        anchorDate: '2026-11-07',
      };

      expect(matchesRule(anchoredOnSaturday, '2026-11-01')).toBe(true);
      expect(matchesRule(anchoredOnSaturday, '2026-11-08')).toBe(false);
      expect(matchesRule(anchoredOnSaturday, '2026-10-18')).toBe(true);
    });
  });

  describe('monthly', () => {
    it('matches a specific day and skips the months without it', () => {
      const rule: RecurrenceRule = { kind: 'monthly_day', day: 31 };

      expect(
        matchingDates(rule, [
          '2026-01-31',
          '2026-02-28',
          '2026-03-01',
          '2026-03-31',
          '2026-04-30',
        ]),
      ).toEqual(['2026-01-31', '2026-03-31']);
    });

    it('matches the last day, including leap years', () => {
      const rule: RecurrenceRule = { kind: 'monthly_last_day' };

      expect(
        matchingDates(rule, [
          '2026-02-28',
          '2024-02-28',
          '2024-02-29',
          '2026-04-30',
          '2026-04-29',
        ]),
      ).toEqual(['2026-02-28', '2024-02-29', '2026-04-30']);
    });

    it('matches a weekday by its position in the month', () => {
      const firstMonday: RecurrenceRule = {
        kind: 'monthly_weekday',
        ordinal: 1,
        weekday: 1,
      };
      const thirdWednesday: RecurrenceRule = {
        kind: 'monthly_weekday',
        ordinal: 3,
        weekday: 3,
      };

      expect(
        matchingDates(firstMonday, ['2026-11-02', '2026-11-09', '2026-12-07']),
      ).toEqual(['2026-11-02', '2026-12-07']);
      expect(
        matchingDates(thirdWednesday, ['2026-11-11', '2026-11-18']),
      ).toEqual(['2026-11-18']);
    });

    it('matches the last weekday of the month', () => {
      const lastFriday: RecurrenceRule = {
        kind: 'monthly_weekday',
        ordinal: 'last',
        weekday: 5,
      };

      expect(
        matchingDates(lastFriday, ['2026-11-20', '2026-11-27', '2026-10-30']),
      ).toEqual(['2026-11-27', '2026-10-30']);
    });
  });

  it('never matches a date that does not exist', () => {
    expect(matchesRule(daily, '2026-02-31')).toBe(false);
  });

  it('treats a malformed remote rule as having no occurrences', () => {
    const malformed = [
      null,
      'daily',
      { kind: 'hourly' },
      { kind: 'interval', everyDays: 0, anchorDate: '2026-01-01' },
      { kind: 'interval', everyDays: 1 },
      { kind: 'weekly', everyWeeks: 1, weekdays: 'all', anchorDate: null },
    ] as unknown as RecurrenceRule[];

    for (const rule of malformed) {
      expect(matchesRule(rule, '2026-11-06')).toBe(false);
    }
  });
});

describe('weekly rule without anchor', () => {
  it('matches every chosen weekday when the weekly rule has no anchor', () => {
    const everyMonday: RecurrenceRule = {
      kind: 'weekly',
      everyWeeks: 1,
      weekdays: [1],
      anchorDate: null,
    };

    expect(matchesRule(everyMonday, '2026-11-09')).toBe(true);
    expect(matchesRule(everyMonday, '2026-11-16')).toBe(true);
    expect(matchesRule(everyMonday, '2026-11-10')).toBe(false);
  });
});

describe('validateRecurrenceRule', () => {
  it('rejects a missing rule as an unknown kind', () => {
    expect(validateRecurrenceRule(null)).toBe('kind');
    expect(validateRecurrenceRule('weekly')).toBe('kind');
  });

  it.each([
    [daily],
    [biweekly],
    [{ kind: 'weekly', everyWeeks: 1, weekdays: [2], anchorDate: null }],
    [{ kind: 'monthly_day', day: 10 }],
    [{ kind: 'monthly_last_day' }],
    [{ kind: 'monthly_weekday', ordinal: 'last', weekday: 5 }],
  ])('accepts %j', (rule) => {
    expect(validateRecurrenceRule(rule)).toBeNull();
  });

  it.each([
    [{ kind: 'interval', everyDays: 0, anchorDate: '2026-01-01' }, 'interval'],
    [
      { kind: 'interval', everyDays: 1.5, anchorDate: '2026-01-01' },
      'interval',
    ],
    [{ kind: 'interval', everyDays: 2, anchorDate: null }, 'anchor'],
    [{ kind: 'interval', everyDays: 2, anchorDate: '2026-02-31' }, 'anchor'],
    [
      { kind: 'weekly', everyWeeks: 0, weekdays: [1], anchorDate: null },
      'interval',
    ],
    [
      { kind: 'weekly', everyWeeks: 1, weekdays: [], anchorDate: null },
      'weekdays',
    ],
    [
      { kind: 'weekly', everyWeeks: 1, weekdays: [7], anchorDate: null },
      'weekdays',
    ],
    [
      { kind: 'weekly', everyWeeks: 2, weekdays: [1], anchorDate: null },
      'anchor',
    ],
    [{ kind: 'monthly_day', day: 0 }, 'day'],
    [{ kind: 'monthly_day', day: 32 }, 'day'],
    [{ kind: 'monthly_weekday', ordinal: 5, weekday: 1 }, 'position'],
    [{ kind: 'monthly_weekday', ordinal: 1, weekday: 9 }, 'position'],
    [{ kind: 'yearly' }, 'kind'],
    [null, 'kind'],
  ])('rejects %j with %s', (rule, error) => {
    expect(validateRecurrenceRule(rule)).toBe(error);
  });
});

describe('schedule history', () => {
  const weekly: RecurrenceRule = {
    kind: 'weekly',
    everyWeeks: 1,
    weekdays: [1],
    anchorDate: null,
  };

  it('applies the first segment to the whole past', () => {
    expect(getRuleAt([{ from: null, rule: daily }], '1999-01-01')).toEqual(
      daily,
    );
  });

  it('keeps the previous rule for dates before a frequency change', () => {
    const schedule = appendScheduleSegment(
      [{ from: null, rule: daily }],
      '2026-11-06',
      weekly,
    );

    expect(getRuleAt(schedule, '2026-11-05')).toEqual(daily);
    expect(getRuleAt(schedule, '2026-11-06')).toEqual(weekly);
    expect(getRuleAt(schedule, '2030-01-01')).toEqual(weekly);
  });

  it('replaces a segment changed twice on the same day', () => {
    const once = appendScheduleSegment(
      [{ from: null, rule: daily }],
      '2026-11-06',
      weekly,
    );
    const twice = appendScheduleSegment(once, '2026-11-06', biweekly);

    expect(twice).toEqual([
      { from: null, rule: daily },
      { from: '2026-11-06', rule: biweekly },
    ]);
  });

  it('adds a segment when only the weekdays change', () => {
    const schedule = [{ from: null, rule: biweekly }];
    const otherWeekdays: RecurrenceRule = {
      kind: 'weekly',
      everyWeeks: 2,
      weekdays: [2, 4],
      anchorDate: '2026-11-02',
    };

    expect(
      appendScheduleSegment(schedule, '2026-11-06', otherWeekdays),
    ).toEqual([
      { from: null, rule: biweekly },
      { from: '2026-11-06', rule: otherWeekdays },
    ]);
  });

  it('starts a schedule from an empty history', () => {
    expect(appendScheduleSegment([], '2026-11-06', daily)).toEqual([
      { from: '2026-11-06', rule: daily },
    ]);
  });

  it('does not add a segment when the rule did not change', () => {
    const schedule = [{ from: null, rule: biweekly }];
    const sameWeekdaysInOtherOrder: RecurrenceRule = {
      kind: 'weekly',
      everyWeeks: 2,
      weekdays: [5, 1, 3],
      anchorDate: '2026-11-02',
    };

    expect(
      appendScheduleSegment(schedule, '2026-11-06', sameWeekdaysInOtherOrder),
    ).toBe(schedule);
  });

  it('pauses from a date and resumes with the last active rule', () => {
    const paused = pauseSchedule([{ from: null, rule: weekly }], '2026-11-06');
    const resumed = resumeSchedule(paused, '2026-11-20');

    expect(isRecurrencePaused(paused)).toBe(true);
    expect(getRuleAt(paused, '2026-11-05')).toEqual(weekly);
    expect(getRuleAt(paused, '2026-11-06')).toBeNull();
    expect(isRecurrencePaused(resumed)).toBe(false);
    expect(getRuleAt(resumed, '2026-11-19')).toBeNull();
    expect(getRuleAt(resumed, '2026-11-20')).toEqual(weekly);
  });

  it('collapses a pause undone on the same day', () => {
    const schedule = [{ from: null, rule: weekly }];
    const resumed = resumeSchedule(
      pauseSchedule(schedule, '2026-11-06'),
      '2026-11-06',
    );

    expect(getRuleAt(resumed, '2026-11-06')).toEqual(weekly);
    expect(isRecurrencePaused(resumed)).toBe(false);
    expect(resumed).toEqual(schedule);
  });

  it('survives a schedule that is not a list', () => {
    expect(getRuleAt(null as never, '2026-11-06')).toBeNull();
    expect(isRecurrencePaused(null as never)).toBe(false);
  });
});

describe('content history', () => {
  const nextContent: RecurrenceContent = {
    text: 'Next',
    bold: true,
    priority: false,
    categoryTagId: null,
    children: [],
  };

  it('uses the content in effect on each date', () => {
    const recurrence = replaceContentForward(
      createRecurrence(),
      nextContent,
      '2026-11-06',
    );

    expect(getContentAt(recurrence, '2026-11-05').text).toBe('Current');
    expect(getContentAt(recurrence, '2026-11-06').text).toBe('Next');
  });

  it('keeps the oldest cut when edited forward twice on the same day', () => {
    const once = replaceContentForward(
      createRecurrence(),
      nextContent,
      '2026-11-06',
    );
    const twice = replaceContentForward(
      once,
      { ...nextContent, text: 'Latest' },
      '2026-11-06',
    );

    expect(twice.contentHistory).toHaveLength(1);
    expect(getContentAt(twice, '2026-11-05').text).toBe('Current');
    expect(getContentAt(twice, '2026-11-06').text).toBe('Latest');
  });

  it('resolves each date to the closest cut after it', () => {
    const first = replaceContentForward(
      createRecurrence(),
      { ...nextContent, text: 'Second' },
      '2026-03-01',
    );
    const second = replaceContentForward(
      first,
      { ...nextContent, text: 'Third' },
      '2026-06-01',
    );

    expect(getContentAt(second, '2026-01-01').text).toBe('Current');
    expect(getContentAt(second, '2026-04-01').text).toBe('Second');
    expect(getContentAt(second, '2026-07-01').text).toBe('Third');
  });
});

describe('content measures', () => {
  const pages = { target: 20, unit: 'pages' };

  it('keeps the measure in the content in effect on each date', () => {
    const recurrence = replaceContentForward(
      createRecurrence({ measure: pages }),
      {
        text: 'Current',
        bold: false,
        priority: false,
        categoryTagId: null,
        children: [],
        measure: { target: 30, unit: 'pages' },
      },
      '2026-11-16',
    );

    expect(getContentAt(recurrence, '2026-11-15').measure).toEqual(pages);
    expect(getContentAt(recurrence, '2026-11-16').measure).toEqual({
      target: 30,
      unit: 'pages',
    });
  });

  it('treats content written before measures as unmeasured', () => {
    const legacyChild = {
      id: 'child',
      parentId: null,
      text: 'Child',
      bold: false,
      priority: false,
      sortRank: 'a0',
    };
    const legacy = createRecurrence({ children: [legacyChild] });

    expect(getContentAt(legacy, '2026-11-06')).toEqual({
      text: 'Current',
      bold: false,
      priority: false,
      categoryTagId: null,
      children: [{ ...legacyChild, measure: null }],
      measure: null,
    });
    expect(
      isSameRecurrenceContent(legacy, {
        ...legacy,
        measure: null,
        children: [{ ...legacyChild, measure: null }],
      }),
    ).toBe(true);
    expect(
      isSameRecurrenceContent(legacy, {
        ...legacy,
        children: [{ ...legacyChild, measure: pages }],
      }),
    ).toBe(false);
    expect(isSameRecurrenceContent(legacy, { ...legacy, measure: pages })).toBe(
      false,
    );
  });

  it('exposes the quantities of the main activity and of each subtask', () => {
    const [occurrence] = getOccurrencesForDate({
      date: '2026-11-06',
      recurrences: [createRecurrence({ measure: pages })],
      responses: [
        createResponse({
          quantity: { ...pages, value: 10 },
          status: 'not_done',
        }),
        createResponse({
          id: 'child-response',
          itemId: 'child',
          quantity: { target: 5, unit: 'min', value: 5 },
        }),
        createResponse({ id: 'binary-child', itemId: 'other' }),
      ],
    });

    expect(occurrence.quantity).toEqual({ ...pages, value: 10 });
    expect(occurrence.childQuantities).toEqual({
      child: { target: 5, unit: 'min', value: 5 },
    });
    expect(occurrence.childStatuses).toEqual({ child: 'done', other: 'done' });
  });

  it('has no quantity for a binary answer', () => {
    const [occurrence] = getOccurrencesForDate({
      date: '2026-11-06',
      recurrences: [createRecurrence()],
      responses: [createResponse()],
    });

    expect(occurrence.quantity).toBeNull();
    expect(occurrence.childQuantities).toEqual({});
  });
});

describe('getOccurrencesForDate', () => {
  const child: RecurrenceChild = {
    id: 'child',
    parentId: null,
    text: 'Child',
    bold: false,
    priority: false,
    sortRank: 'a0',
  };

  it('lists the recurrences scheduled on the date in creation order', () => {
    const newer = createRecurrence({
      id: 'newer',
      createdAt: '2026-02-01T00:00:00.000Z',
    });
    const older = createRecurrence({ id: 'older' });

    expect(
      getOccurrencesForDate({
        date: '2026-11-06',
        recurrences: [newer, older],
        responses: [],
      }).map((occurrence) => occurrence.recurrence.id),
    ).toEqual(['older', 'newer']);
  });

  it('skips the deleted, the paused and the unscheduled', () => {
    expect(
      getOccurrencesForDate({
        date: '2026-11-06',
        recurrences: [
          createRecurrence({
            id: 'deleted',
            deletedAt: '2026-11-01T00:00:00.000Z',
          }),
          createRecurrence({
            id: 'paused',
            schedule: [{ from: null, rule: null }],
          }),
          createRecurrence({
            id: 'other-day',
            schedule: [{ from: null, rule: { kind: 'monthly_day', day: 1 } }],
          }),
        ],
        responses: [],
      }),
    ).toEqual([]);
  });

  it('keeps an answered occurrence the schedule no longer predicts, once', () => {
    const paused = createRecurrence({
      schedule: [{ from: null, rule: null }],
    });
    const scheduled = createRecurrence({ id: 'scheduled' });

    const occurrences = getOccurrencesForDate({
      date: '2026-11-06',
      recurrences: [paused, scheduled],
      responses: [
        createResponse(),
        createResponse({ id: 'other', recurrenceId: 'scheduled' }),
      ],
    });

    expect(occurrences.map((item) => item.recurrence.id)).toEqual([
      'recurrence-1',
      'scheduled',
    ]);
  });

  it('does not keep an occurrence because of a pending or child answer', () => {
    const paused = createRecurrence({
      schedule: [{ from: null, rule: null }],
    });

    expect(
      getOccurrencesForDate({
        date: '2026-11-06',
        recurrences: [paused],
        responses: [
          createResponse({ deletedAt: '2026-11-06T00:00:00.000Z' }),
          createResponse({ id: 'child', itemId: 'child' }),
        ],
      }),
    ).toEqual([]);
  });

  it('separates the statuses of the activity and its children', () => {
    const [occurrence] = getOccurrencesForDate({
      date: '2026-11-06',
      recurrences: [createRecurrence({ children: [child] })],
      responses: [
        createResponse({ status: 'not_done' }),
        createResponse({ id: 'child', itemId: 'child', status: 'done' }),
        createResponse({
          id: 'other-date',
          date: '2026-11-05',
          status: 'done',
        }),
      ],
    });

    expect(occurrence.status).toBe('not_done');
    expect(occurrence.childStatuses).toEqual({ child: 'done' });
  });

  it('shows the content in effect on the date', () => {
    const recurrence = replaceContentForward(
      createRecurrence(),
      {
        text: 'Next',
        bold: false,
        priority: false,
        categoryTagId: null,
        children: [],
      },
      '2026-11-06',
    );

    expect(
      getOccurrencesForDate({
        date: '2026-11-05',
        recurrences: [recurrence],
        responses: [],
      })[0].content.text,
    ).toBe('Current');
  });
});

describe('canRespondOnDate', () => {
  it('allows today and past dates only', () => {
    expect(canRespondOnDate('2026-11-05', '2026-11-06')).toBe(true);
    expect(canRespondOnDate('2026-11-06', '2026-11-06')).toBe(true);
    expect(canRespondOnDate('2026-11-07', '2026-11-06')).toBe(false);
  });
});

describe('buildRecurrenceResponseId', () => {
  it('is the same on every device and distinct per item', () => {
    const base = {
      scopeId: 'user:owner' as const,
      recurrenceId: 'recurrence-1',
      date: '2026-11-06' as const,
    };

    expect(buildRecurrenceResponseId({ ...base, itemId: null })).toBe(
      'rr:user:owner:recurrence-1:2026-11-06:root',
    );
    expect(buildRecurrenceResponseId({ ...base, itemId: 'child' })).toBe(
      'rr:user:owner:recurrence-1:2026-11-06:child',
    );
  });
});

describe('recurrence boundaries', () => {
  const rules: RecurrenceRule[] = [
    { kind: 'interval', everyDays: 2, anchorDate: '2026-01-01' },
    { kind: 'interval', everyDays: 3, anchorDate: '2026-01-01' },
    { kind: 'interval', everyDays: 2, anchorDate: '2026-01-02' },
    { kind: 'weekly', everyWeeks: 2, weekdays: [1], anchorDate: '2026-01-01' },
    { kind: 'weekly', everyWeeks: 3, weekdays: [1], anchorDate: '2026-01-01' },
    { kind: 'weekly', everyWeeks: 2, weekdays: [2], anchorDate: '2026-01-01' },
    { kind: 'weekly', everyWeeks: 2, weekdays: [1], anchorDate: '2026-01-08' },
    { kind: 'monthly_day', day: 1 },
    { kind: 'monthly_day', day: 2 },
    { kind: 'monthly_last_day' },
    { kind: 'monthly_weekday', ordinal: 1, weekday: 1 },
    { kind: 'monthly_weekday', ordinal: 2, weekday: 1 },
    { kind: 'monthly_weekday', ordinal: 1, weekday: 2 },
  ];

  it.each([
    [20261106],
    [' 2026-11-06'],
    ['2026-11-06x'],
    ['12026-11-06'],
    ['0099-01-01'],
    ['2026-13-01'],
    ['2026-00-10'],
    ['2026-04-31'],
    ['2026-01-00'],
  ])('rejects %j as a calendar date', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it('accepts the limits of weekdays and positions', () => {
    expect(
      validateRecurrenceRule({
        kind: 'weekly',
        everyWeeks: 1,
        weekdays: [0, 6],
        anchorDate: null,
      }),
    ).toBeNull();
    expect(
      validateRecurrenceRule({
        kind: 'monthly_weekday',
        ordinal: 4,
        weekday: 6,
      }),
    ).toBeNull();
    expect(validateRecurrenceRule({ kind: 'monthly_day', day: 31 })).toBeNull();
  });

  it.each([[[-1]], [[7]], [[1.5]], [['1']], [[1, 9]], [[9, 1]]])(
    'rejects the weekdays %j',
    (weekdays) => {
      expect(
        validateRecurrenceRule({
          kind: 'weekly',
          everyWeeks: 1,
          weekdays,
          anchorDate: null,
        }),
      ).toBe('weekdays');
    },
  );

  it.each([[123], ['weekly'], [true]])('rejects the rule %j', (rule) => {
    expect(validateRecurrenceRule(rule)).toBe('kind');
  });

  it('does not match another weekday in the same position', () => {
    const firstMonday: RecurrenceRule = {
      kind: 'monthly_weekday',
      ordinal: 1,
      weekday: 1,
    };

    expect(matchesRule(firstMonday, '2026-11-02')).toBe(true);
    expect(matchesRule(firstMonday, '2026-11-03')).toBe(false);
  });

  it('treats only the final seven days as the last position', () => {
    const lastMonday: RecurrenceRule = {
      kind: 'monthly_weekday',
      ordinal: 'last',
      weekday: 1,
    };

    expect(matchesRule(lastMonday, '2026-11-30')).toBe(true);
    expect(matchesRule(lastMonday, '2026-11-23')).toBe(false);
    expect(matchesRule(lastMonday, '2026-08-31')).toBe(true);
    expect(matchesRule(lastMonday, '2026-08-24')).toBe(false);
  });

  it('counts whole weeks in a seven week cycle', () => {
    const everySeven: RecurrenceRule = {
      kind: 'weekly',
      everyWeeks: 7,
      weekdays: [1],
      anchorDate: '2026-01-05',
    };

    expect(matchesRule(everySeven, '2026-01-05')).toBe(true);
    expect(matchesRule(everySeven, '2026-01-12')).toBe(false);
    expect(matchesRule(everySeven, '2026-02-23')).toBe(true);
  });

  it('appends every different rule and ignores every identical one', () => {
    for (const [index, rule] of rules.entries()) {
      const other = rules[(index + 1) % rules.length];
      const schedule = [{ from: null, rule }];

      expect(appendScheduleSegment(schedule, '2026-11-06', rule)).toBe(
        schedule,
      );
      expect(appendScheduleSegment(schedule, '2026-11-06', other)).toEqual([
        { from: null, rule },
        { from: '2026-11-06', rule: other },
      ]);
    }
  });

  it('only replaces the last segment of a longer schedule on the same day', () => {
    const schedule = [
      { from: null, rule: rules[0] },
      { from: '2026-01-01' as const, rule: rules[1] },
      { from: '2026-11-06' as const, rule: rules[2] },
    ];

    expect(appendScheduleSegment(schedule, '2026-11-06', rules[3])).toEqual([
      schedule[0],
      schedule[1],
      { from: '2026-11-06', rule: rules[3] },
    ]);
  });

  it('does not pause twice nor treat an empty schedule as paused', () => {
    const paused = pauseSchedule(
      [{ from: null, rule: rules[0] }],
      '2026-11-06',
    );

    expect(pauseSchedule(paused, '2026-11-07')).toBe(paused);
    expect(isRecurrencePaused([])).toBe(false);
  });

  it('resolves an out of order schedule by date', () => {
    const schedule = [
      { from: '2026-06-01' as const, rule: rules[0] },
      { from: '2026-01-01' as const, rule: rules[1] },
    ];

    expect(getRuleAt(schedule, '2026-07-01')).toEqual(rules[0]);
    expect(getRuleAt(schedule, '2026-02-01')).toEqual(rules[1]);
    expect(getRuleAt(schedule, '2025-01-01')).toBeNull();
  });

  it('survives malformed schedule entries', () => {
    const schedule = [null, { from: null, rule: rules[0] }] as never;

    expect(getRuleAt(schedule, '2026-07-01')).toEqual(rules[0]);
    expect(getLatestRule(schedule)).toEqual(rules[0]);
    expect(getLatestRule('broken' as never)).toBeNull();
    expect(getLatestRule([])).toBeNull();
  });

  it('resumes to the last active rule and keeps a schedule without one', () => {
    const schedule = [{ from: null, rule: null }];

    expect(resumeSchedule(schedule, '2026-11-06')).toEqual(schedule);
    expect(
      getLatestRule([
        { from: null, rule: rules[0] },
        { from: '2026-01-01', rule: rules[1] },
        { from: '2026-02-01', rule: null },
      ]),
    ).toEqual(rules[1]);
  });

  it('compares the content that matters', () => {
    const content: RecurrenceContent = {
      text: 'A',
      bold: false,
      priority: false,
      categoryTagId: null,
      children: [],
    };

    expect(isSameRecurrenceContent(content, { ...content })).toBe(true);
    expect(isSameRecurrenceContent(content, { ...content, text: 'B' })).toBe(
      false,
    );
    expect(
      isSameRecurrenceContent(content, {
        ...createRecurrence(content),
      }),
    ).toBe(true);
  });

  it('resolves an out of order content history', () => {
    const snapshot = (text: string, until: LocalDateString) => ({
      text,
      until,
      bold: false,
      priority: false,
      categoryTagId: null,
      children: [],
    });
    const recurrence = createRecurrence({
      contentHistory: [
        snapshot('Second', '2026-06-01'),
        snapshot('First', '2026-03-01'),
      ],
    });

    expect(getContentAt(recurrence, '2026-01-01').text).toBe('First');
    expect(getContentAt(recurrence, '2026-03-01').text).toBe('Second');
    expect(getContentAt(recurrence, '2026-06-01').text).toBe('Current');
  });

  it('ignores a content history that is not a list', () => {
    expect(
      getContentAt(
        createRecurrence({ contentHistory: 'broken' as never }),
        '2026-01-01',
      ).text,
    ).toBe('Current');
  });

  it('only reads the answers of that recurrence on that date', () => {
    const occurrences = getOccurrencesForDate({
      date: '2026-11-06',
      recurrences: [createRecurrence()],
      responses: [
        createResponse({ id: 'other-date', date: '2026-11-05' }),
        createResponse({ id: 'other-activity', recurrenceId: 'other' }),
        createResponse({
          id: 'other-child',
          recurrenceId: 'other',
          itemId: 'child',
        }),
        createResponse({
          id: 'cleared',
          deletedAt: '2026-11-06T00:00:00.000Z',
        }),
      ],
    });

    expect(occurrences[0].status).toBeNull();
    expect(occurrences[0].childStatuses).toEqual({});
  });

  it('skips a rule that does not fall on the date', () => {
    expect(
      getOccurrencesForDate({
        date: '2026-11-06',
        recurrences: [
          createRecurrence({
            schedule: [{ from: null, rule: { kind: 'monthly_day', day: 1 } }],
          }),
        ],
        responses: [],
      }),
    ).toEqual([]);
  });
});
