import { describe, expect, it } from 'vitest';
import {
  createMonthGrid,
  getMonthRange,
  getVisibleMonthGridRange,
  toLocalDateKey,
} from '@/lib/time';

describe('local day helpers', () => {
  it('formats a local date key in the app timezone instead of UTC', () => {
    const date = new Date('2026-05-13T02:30:00.000Z');

    expect(toLocalDateKey(date, 'America/Sao_Paulo')).toBe('2026-05-12');
  });

  it('handles month ranges across year boundaries', () => {
    expect(getMonthRange('2026-12-15')).toEqual({
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    });
  });

  it('creates a stable six-week calendar grid', () => {
    const grid = createMonthGrid('2026-05-13');

    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: '2026-04-26', inCurrentMonth: false });
    expect(grid[5]).toEqual({ date: '2026-05-01', inCurrentMonth: true });
  });

  it('returns the full visible grid range for the month view', () => {
    expect(getVisibleMonthGridRange('2026-05-13')).toEqual({
      startDate: '2026-04-26',
      endDate: '2026-06-06',
    });
  });
});
