import { describe, expect, it } from 'vitest';
import {
  createMonthGrid,
  createWeekGrid,
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

describe('createWeekGrid', () => {
  it('builds the sunday to saturday week around the anchor day', () => {
    const week = createWeekGrid('2026-08-20', '2026-08-01');

    expect(week).toHaveLength(7);
    expect(week[0].date).toBe('2026-08-16');
    expect(week[6].date).toBe('2026-08-22');
  });

  it('keeps the anchor day inside the week', () => {
    const week = createWeekGrid('2026-08-16', '2026-08-01');

    expect(week.map((day) => day.date)).toContain('2026-08-16');
    expect(week[0].date).toBe('2026-08-16');
  });

  it('marks days outside the visible month when the week crosses it', () => {
    const week = createWeekGrid('2026-08-31', '2026-08-01');

    expect(week[0]).toEqual({ date: '2026-08-30', inCurrentMonth: true });
    expect(week[1]).toEqual({ date: '2026-08-31', inCurrentMonth: true });
    expect(week[2]).toEqual({ date: '2026-09-01', inCurrentMonth: false });
    expect(week[6]).toEqual({ date: '2026-09-05', inCurrentMonth: false });
  });

  it('resolves the current month from the given month, not from the anchor', () => {
    const week = createWeekGrid('2026-08-31', '2026-09-01');

    expect(week[0].inCurrentMonth).toBe(false);
    expect(week[2].inCurrentMonth).toBe(true);
  });

  it('crosses the year boundary', () => {
    const week = createWeekGrid('2026-12-31', '2026-12-01');

    expect(week[0].date).toBe('2026-12-27');
    expect(week[6].date).toBe('2027-01-02');
    expect(week[6].inCurrentMonth).toBe(false);
  });
});
