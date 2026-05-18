import { describe, expect, it } from 'vitest';
import {
  formatDateInputValue,
  getDatesInRangeForWeekdays,
  getLocalDateWeekday,
  maskDateInput,
  parseDateInputValue,
} from '@/lib/time';

describe('date input helpers', () => {
  it('masks typed values as DD-MM-YYYY with numeric-only input', () => {
    expect(maskDateInput('1a2b3c4d56789')).toBe('12-34-5678');
    expect(maskDateInput('01012026')).toBe('01-01-2026');
    expect(maskDateInput('0101')).toBe('01-01');
  });

  it('formats and parses valid date input values', () => {
    expect(formatDateInputValue('2026-11-10')).toBe('10-11-2026');
    expect(parseDateInputValue('10-11-2026')).toBe('2026-11-10');
    expect(parseDateInputValue('10012026')).toBe('2026-01-10');
  });

  it('rejects incomplete or invalid dates', () => {
    expect(parseDateInputValue('10-11-202')).toBeNull();
    expect(parseDateInputValue('31-02-2026')).toBeNull();
    expect(parseDateInputValue('00-12-2026')).toBeNull();
  });

  it('expands a range filtered by selected weekdays', () => {
    expect(getLocalDateWeekday('2026-01-05')).toBe(1);
    expect(
      getDatesInRangeForWeekdays({
        startDate: '2026-01-01',
        endDate: '2026-01-10',
        selectedWeekdays: [1, 2, 3, 4, 5],
      }),
    ).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
    ]);
  });
});
