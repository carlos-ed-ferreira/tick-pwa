import { describe, expect, it } from 'vitest';
import {
  getCalendarDayDensity,
  getVisibleCategoryLimit,
} from '@/features/calendar/calendar-day-density';

describe('getCalendarDayDensity', () => {
  it('treats an unmeasured cell as comfortable', () => {
    expect(getCalendarDayDensity(0)).toBe('comfortable');
  });

  it('is compact on a narrow phone cell', () => {
    expect(getCalendarDayDensity(47)).toBe('compact');
  });

  it('is compact on a large phone cell', () => {
    expect(getCalendarDayDensity(55)).toBe('compact');
  });

  it('is comfortable from the small breakpoint upwards', () => {
    expect(getCalendarDayDensity(85)).toBe('comfortable');
  });

  it('is comfortable on desktop cells', () => {
    expect(getCalendarDayDensity(174)).toBe('comfortable');
  });
});

describe('getVisibleCategoryLimit', () => {
  it('is unbounded before the grid is measured', () => {
    expect(getVisibleCategoryLimit(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('always keeps at least one dot visible', () => {
    expect(getVisibleCategoryLimit(12)).toBe(1);
  });

  it('uses the compact padding budget on narrow cells', () => {
    expect(getVisibleCategoryLimit(47)).toBe(2);
  });

  it('fits more dots on a desktop cell', () => {
    expect(getVisibleCategoryLimit(174)).toBe(8);
  });
});
