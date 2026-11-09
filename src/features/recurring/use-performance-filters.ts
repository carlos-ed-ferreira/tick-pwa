'use client';

import { useMemo, useState } from 'react';
import {
  ALL_CATEGORY_TAB_ID,
  getPerformanceRange,
  validatePerformanceRange,
  type LocalDateString,
  type PerformanceRangeError,
  type RecurrencePerformanceSort,
} from '@/lib/domain';
import { formatDateInputValue, parseDateInputValue } from '@/lib/time';

export type PerformancePeriod = '7' | '30' | '90' | 'custom';

export interface PerformanceFilters {
  categoryTabId: string;
  customEnd: string;
  customStart: string;
  period: PerformancePeriod;
  range: { endDate: LocalDateString; startDate: LocalDateString } | null;
  rangeError: PerformanceRangeError | null;
  sort: RecurrencePerformanceSort;
  setCategoryTabId: (tabId: string) => void;
  setCustomEnd: (value: string) => void;
  setCustomStart: (value: string) => void;
  setPeriod: (period: PerformancePeriod) => void;
  setSort: (sort: RecurrencePerformanceSort) => void;
}

function resolveCustomRange(customStart: string, customEnd: string) {
  const startDate = parseDateInputValue(customStart);
  const endDate = parseDateInputValue(customEnd);

  if (!startDate || !endDate) {
    return { range: null, rangeError: 'invalid' as const };
  }

  const rangeError = validatePerformanceRange(startDate, endDate);

  return rangeError
    ? { range: null, rangeError }
    : { range: { endDate, startDate }, rangeError: null };
}

export function usePerformanceFilters(
  today: LocalDateString,
): PerformanceFilters {
  const [period, setPeriodState] = useState<PerformancePeriod>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [categoryTabId, setCategoryTabId] = useState(ALL_CATEGORY_TAB_ID);
  const [sort, setSort] = useState<RecurrencePerformanceSort>('name');
  const resolved = useMemo(
    () =>
      period === 'custom'
        ? resolveCustomRange(customStart, customEnd)
        : {
            range: getPerformanceRange(Number(period), today),
            rangeError: null,
          },
    [customEnd, customStart, period, today],
  );

  function setPeriod(next: PerformancePeriod) {
    if (next === 'custom' && period !== 'custom' && resolved.range) {
      setCustomStart(formatDateInputValue(resolved.range.startDate));
      setCustomEnd(formatDateInputValue(resolved.range.endDate));
    }

    setPeriodState(next);
  }

  return {
    categoryTabId,
    customEnd,
    customStart,
    period,
    ...resolved,
    setCategoryTabId,
    setCustomEnd,
    setCustomStart,
    setPeriod,
    setSort,
    sort,
  };
}
