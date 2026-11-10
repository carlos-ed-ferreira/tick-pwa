import { describe, expect, it } from 'vitest';
import {
  getQuantityOutcome,
  getQuantityProgress,
  getQuantityStatus,
  isMeasurableItem,
  normalizeMeasureUnit,
  parseQuantityInput,
  summarizeQuantities,
  validateRecurrenceMeasure,
  validateQuantityValue,
  type RecurrenceContent,
} from '@/lib/domain';

const pages = { target: 20, unit: 'páginas' };

describe('quantity outcome', () => {
  it.each([
    [0, 'zero', 'not_done'],
    [10, 'partial', 'not_done'],
    [20, 'done', 'done'],
    [35, 'done', 'done'],
  ] as const)('classifies %s of 20 pages', (value, outcome, status) => {
    const quantity = { ...pages, value };

    expect(getQuantityOutcome(quantity)).toBe(outcome);
    expect(getQuantityStatus(quantity)).toBe(status);
  });

  it('compares decimals exactly', () => {
    expect(getQuantityOutcome({ target: 5.5, unit: 'km', value: 5.5 })).toBe(
      'done',
    );
    expect(getQuantityOutcome({ target: 5.5, unit: 'km', value: 5.4 })).toBe(
      'partial',
    );
    expect(
      getQuantityOutcome({ target: 0.3, unit: 'l', value: 0.1 + 0.2 }),
    ).toBe('done');
  });

  it('caps the progress at the target', () => {
    expect(getQuantityProgress({ ...pages, value: 10 })).toBe(0.5);
    expect(getQuantityProgress({ ...pages, value: 35 })).toBe(1);
    expect(getQuantityProgress({ ...pages, value: 0 })).toBe(0);
  });
});

describe('validation', () => {
  it('accepts a positive target and a short unit', () => {
    expect(validateRecurrenceMeasure(pages)).toBeNull();
    expect(validateRecurrenceMeasure({ target: 0.001, unit: 'km' })).toBeNull();
  });

  it.each([
    [{ target: 0, unit: 'km' }, 'target'],
    [{ target: -1, unit: 'km' }, 'target'],
    [{ target: Number.NaN, unit: 'km' }, 'target'],
    [{ target: Number.POSITIVE_INFINITY, unit: 'km' }, 'target'],
    [{ target: 1.0001, unit: 'km' }, 'target'],
    [{ target: 1_000_001, unit: 'km' }, 'target'],
    [{ target: 5, unit: '   ' }, 'unit'],
    [{ target: 5, unit: 'x'.repeat(25) }, 'unit'],
  ] as const)('rejects %j', (measure, error) => {
    expect(validateRecurrenceMeasure(measure)).toBe(error);
  });

  it('accepts zero and values above the target, but not negatives', () => {
    expect(validateQuantityValue(0)).toBe(true);
    expect(validateQuantityValue(35)).toBe(true);
    expect(validateQuantityValue(5.125)).toBe(true);
    expect(validateQuantityValue(-1)).toBe(false);
    expect(validateQuantityValue(5.1255)).toBe(false);
    expect(validateQuantityValue(Number.NaN)).toBe(false);
    expect(validateQuantityValue(1_000_001)).toBe(false);
  });

  it('normalizes the unit spacing', () => {
    expect(normalizeMeasureUnit('  páginas   lidas ')).toBe('páginas lidas');
  });
});

describe('parseQuantityInput', () => {
  it.each([
    ['20', 20],
    ['5,5', 5.5],
    ['5.5', 5.5],
    [' 1,25 ', 1.25],
    ['0', 0],
  ])('reads %s', (input, value) => {
    expect(parseQuantityInput(input)).toBe(value);
  });

  it.each(['', 'abc', '1,2,3', '1.2.3', '-1', '1e3', '5,'])(
    'rejects %s',
    (input) => {
      expect(parseQuantityInput(input)).toBeNull();
    },
  );
});

describe('isMeasurableItem', () => {
  const content: RecurrenceContent = {
    text: 'Morning',
    bold: false,
    priority: false,
    categoryTagId: null,
    children: [
      {
        id: 'a',
        parentId: null,
        text: 'Stretch',
        bold: false,
        priority: false,
        sortRank: 'a0',
      },
      {
        id: 'b',
        parentId: null,
        text: 'Meditate',
        bold: false,
        priority: false,
        sortRank: 'a1',
      },
      {
        id: 'c',
        parentId: 'b',
        text: 'Breathe',
        bold: false,
        priority: false,
        sortRank: 'a0',
      },
    ],
  };

  it('allows only items without children', () => {
    expect(isMeasurableItem(content, null)).toBe(false);
    expect(isMeasurableItem(content, 'a')).toBe(true);
    expect(isMeasurableItem(content, 'b')).toBe(false);
    expect(isMeasurableItem(content, 'c')).toBe(true);
    expect(isMeasurableItem(content, 'missing')).toBe(false);
    expect(isMeasurableItem({ ...content, children: [] }, null)).toBe(true);
  });
});

describe('summarizeQuantities', () => {
  it('keeps the real total and caps the progress per occurrence', () => {
    expect(
      summarizeQuantities([
        { ...pages, value: 10 },
        { ...pages, value: 20 },
        { ...pages, value: 30 },
        { ...pages, value: 0 },
      ]),
    ).toEqual([
      {
        capped: 50,
        count: 4,
        done: 2,
        expected: 80,
        partial: 1,
        progress: 62.5,
        realized: 60,
        unit: 'páginas',
        zero: 1,
      },
    ]);
  });

  it('keeps different units apart', () => {
    expect(
      summarizeQuantities([
        { target: 20, unit: 'páginas', value: 10 },
        { target: 30, unit: 'minutos', value: 30 },
      ]).map((summary) => [summary.unit, summary.realized, summary.progress]),
    ).toEqual([
      ['páginas', 10, 50],
      ['minutos', 30, 100],
    ]);
  });

  it('sums decimals without drift', () => {
    expect(
      summarizeQuantities([
        { target: 1, unit: 'l', value: 0.1 },
        { target: 1, unit: 'l', value: 0.2 },
      ])[0].realized,
    ).toBe(0.3);
  });
});
