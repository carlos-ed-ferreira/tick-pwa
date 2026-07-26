import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_DAYS,
  MAX_IMPORT_ITEMS,
  parseCalendarImportPayload,
} from '@/features/calendar/calendar-import-parser';

function parseOrThrow(rawJson: string) {
  const result = parseCalendarImportPayload(rawJson);

  if (!result.ok) {
    throw new Error(
      `Expected a valid payload, got: ${JSON.stringify(result.errors)}`,
    );
  }

  return result;
}

function errorCodes(rawJson: string): string[] {
  const result = parseCalendarImportPayload(rawJson);

  if (result.ok) {
    throw new Error('Expected an invalid payload.');
  }

  return result.errors.map((error) => error.code);
}

describe('parseCalendarImportPayload', () => {
  it('parses a payload with only the required text field', () => {
    const result = parseOrThrow(
      JSON.stringify({
        version: 1,
        days: [{ date: '2026-07-26', items: [{ text: 'Revisar PRs' }] }],
      }),
    );

    expect(result.itemCount).toBe(1);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].date).toBe('2026-07-26');
    expect(result.days[0].items[0]).toMatchObject({
      parentId: null,
      text: 'Revisar PRs',
      scheduledTime: null,
      checked: false,
      priority: false,
      collapsed: false,
      category: null,
    });
    expect(result.days[0].items[0].id).toBeTruthy();
    expect(result.days[0].items[0].sortRank).toBeTruthy();
  });

  it('parses optional time, priority and category', () => {
    const result = parseOrThrow(
      JSON.stringify({
        days: [
          {
            date: '2026-07-26',
            items: [
              {
                text: 'Academia',
                time: '07:30',
                priority: true,
                category: { name: 'Saúde', color: '#16A34A' },
              },
            ],
          },
        ],
      }),
    );

    expect(result.days[0].items[0]).toMatchObject({
      text: 'Academia',
      scheduledTime: '07:30',
      priority: true,
      category: { name: 'Saúde', colorHex: '#16a34a' },
    });
  });

  it('accepts single digit hours and pads them', () => {
    const result = parseOrThrow(
      JSON.stringify({
        days: [{ date: '2026-07-26', items: [{ text: 'Café', time: '7:05' }] }],
      }),
    );

    expect(result.days[0].items[0].scheduledTime).toBe('07:05');
  });

  it('treats empty or null time as no time', () => {
    const result = parseOrThrow(
      JSON.stringify({
        days: [
          {
            date: '2026-07-26',
            items: [
              { text: 'Sem horário', time: '' },
              { text: 'Também sem', time: null },
            ],
          },
        ],
      }),
    );

    expect(result.days[0].items[0].scheduledTime).toBeNull();
    expect(result.days[0].items[1].scheduledTime).toBeNull();
  });

  it('trims text and keeps the order of the items', () => {
    const result = parseOrThrow(
      JSON.stringify({
        days: [
          {
            date: '2026-07-26',
            items: [{ text: '  Primeiro  ' }, { text: 'Segundo' }],
          },
        ],
      }),
    );

    expect(result.days[0].items.map((item) => item.text)).toEqual([
      'Primeiro',
      'Segundo',
    ]);
    expect(
      result.days[0].items[0].sortRank < result.days[0].items[1].sortRank,
    ).toBe(true);
  });

  it('flattens nested children into parentId references', () => {
    const result = parseOrThrow(
      JSON.stringify({
        days: [
          {
            date: '2026-07-26',
            items: [
              {
                text: 'Academia',
                children: [
                  { text: 'Levar garrafa' },
                  {
                    text: 'Levar toalha',
                    children: [{ text: 'Lavar depois' }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    const items = result.days[0].items;
    expect(result.itemCount).toBe(4);
    expect(items).toHaveLength(4);

    const root = items.find((item) => item.text === 'Academia');
    const towel = items.find((item) => item.text === 'Levar toalha');
    const wash = items.find((item) => item.text === 'Lavar depois');

    expect(root?.parentId).toBeNull();
    expect(towel?.parentId).toBe(root?.id);
    expect(wash?.parentId).toBe(towel?.id);
  });

  it('accepts a bare array of days', () => {
    const result = parseOrThrow(
      JSON.stringify([
        { date: '2026-07-26', items: [{ text: 'Revisar PRs' }] },
      ]),
    );

    expect(result.days).toHaveLength(1);
  });

  it('skips days without items but keeps the valid ones', () => {
    const result = parseOrThrow(
      JSON.stringify({
        days: [
          { date: '2026-07-26', items: [] },
          { date: '2026-07-27', items: [{ text: 'Revisar PRs' }] },
        ],
      }),
    );

    expect(result.days.map((day) => day.date)).toEqual(['2026-07-27']);
  });

  it('rejects malformed json', () => {
    const result = parseCalendarImportPayload('{ days: [');

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0].code).toBe('invalidJson');
      expect(result.errors[0].detail).toBeTruthy();
    }
  });

  it('rejects a payload without the days array', () => {
    expect(errorCodes(JSON.stringify({ items: [] }))).toEqual(['invalidRoot']);
    expect(errorCodes(JSON.stringify('nope'))).toEqual(['invalidRoot']);
  });

  it('rejects a payload with no importable task', () => {
    expect(errorCodes(JSON.stringify({ days: [] }))).toEqual(['emptyPayload']);
  });

  it('rejects invalid dates', () => {
    expect(
      errorCodes(
        JSON.stringify({
          days: [{ date: '26-07-2026', items: [{ text: 'a' }] }],
        }),
      ),
    ).toEqual(['invalidDate']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [{ date: '2026-02-31', items: [{ text: 'a' }] }],
        }),
      ),
    ).toEqual(['invalidDate']);
    expect(
      errorCodes(JSON.stringify({ days: [{ items: [{ text: 'a' }] }] })),
    ).toEqual(['invalidDate']);
  });

  it('rejects days and items with the wrong shape', () => {
    expect(errorCodes(JSON.stringify({ days: ['2026-07-26'] }))).toEqual([
      'invalidDay',
    ]);
    expect(
      errorCodes(JSON.stringify({ days: [{ date: '2026-07-26' }] })),
    ).toEqual(['invalidItems']);
    expect(
      errorCodes(
        JSON.stringify({ days: [{ date: '2026-07-26', items: ['tarefa'] }] }),
      ),
    ).toEqual(['invalidItem']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            { date: '2026-07-26', items: [{ text: 'a', children: 'nope' }] },
          ],
        }),
      ),
    ).toEqual(['invalidChildren']);
  });

  it('rejects items without usable text', () => {
    expect(
      errorCodes(
        JSON.stringify({ days: [{ date: '2026-07-26', items: [{}] }] }),
      ),
    ).toEqual(['requireText']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [{ date: '2026-07-26', items: [{ text: '   ' }] }],
        }),
      ),
    ).toEqual(['requireText']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [{ date: '2026-07-26', items: [{ text: 12 }] }],
        }),
      ),
    ).toEqual(['requireText']);
  });

  it('rejects invalid time and priority values', () => {
    expect(
      errorCodes(
        JSON.stringify({
          days: [{ date: '2026-07-26', items: [{ text: 'a', time: '25:90' }] }],
        }),
      ),
    ).toEqual(['invalidTime']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [{ date: '2026-07-26', items: [{ text: 'a', time: '7h' }] }],
        }),
      ),
    ).toEqual(['invalidTime']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            { date: '2026-07-26', items: [{ text: 'a', priority: 'sim' }] },
          ],
        }),
      ),
    ).toEqual(['invalidPriority']);
  });

  it('requires both name and color on a category', () => {
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            {
              date: '2026-07-26',
              items: [{ text: 'a', category: { name: 'Saúde' } }],
            },
          ],
        }),
      ),
    ).toEqual(['invalidCategory']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            { date: '2026-07-26', items: [{ text: 'a', category: 'Saúde' }] },
          ],
        }),
      ),
    ).toEqual(['invalidCategory']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            {
              date: '2026-07-26',
              items: [
                { text: 'a', category: { name: '  ', color: '#16a34a' } },
              ],
            },
          ],
        }),
      ),
    ).toEqual(['invalidCategory']);
  });

  it('rejects colors that are not six digit hex', () => {
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            {
              date: '2026-07-26',
              items: [
                { text: 'a', category: { name: 'Saúde', color: '#1a3' } },
              ],
            },
          ],
        }),
      ),
    ).toEqual(['invalidColor']);
    expect(
      errorCodes(
        JSON.stringify({
          days: [
            {
              date: '2026-07-26',
              items: [
                { text: 'a', category: { name: 'Saúde', color: 'green' } },
              ],
            },
          ],
        }),
      ),
    ).toEqual(['invalidColor']);
  });

  it('reports the path of every error instead of stopping at the first', () => {
    const result = parseCalendarImportPayload(
      JSON.stringify({
        days: [
          {
            date: '2026-07-26',
            items: [
              { text: 'ok' },
              { text: '' },
              { text: 'c', time: '99:99', children: [{ text: '' }] },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.map((error) => error.path)).toEqual([
        'days[0].items[1].text',
        'days[0].items[2].time',
        'days[0].items[2].children[0].text',
      ]);
    }
  });

  it('rejects payloads over the day and item limits', () => {
    const tooManyDays = {
      days: Array.from({ length: MAX_IMPORT_DAYS + 1 }, (_unused, index) => ({
        date: '2026-07-26',
        items: [{ text: `Tarefa ${index}` }],
      })),
    };
    const tooManyItems = {
      days: [
        {
          date: '2026-07-26',
          items: Array.from(
            { length: MAX_IMPORT_ITEMS + 1 },
            (_unused, index) => ({ text: `Tarefa ${index}` }),
          ),
        },
      ],
    };

    expect(errorCodes(JSON.stringify(tooManyDays))).toEqual(['limitExceeded']);
    expect(errorCodes(JSON.stringify(tooManyItems))).toEqual(['limitExceeded']);
  });
});
