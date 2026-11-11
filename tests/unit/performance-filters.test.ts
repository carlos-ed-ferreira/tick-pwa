import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SupportedLocale } from '@/lib/domain';
import { usePerformanceFilters } from '@/features/recurring/use-performance-filters';

describe('performance date inputs', () => {
  it('preserves the selected range when the language changes', () => {
    const { result, rerender } = renderHook(
      ({ locale }: { locale: SupportedLocale }) =>
        usePerformanceFilters('2026-11-11', locale),
      { initialProps: { locale: 'en' as SupportedLocale } },
    );
    act(() => result.current.setPeriod('custom'));
    act(() => {
      result.current.setCustomStart('11/02/2026');
      result.current.setCustomEnd('11/09/2026');
    });
    const range = { startDate: '2026-11-02', endDate: '2026-11-09' };
    expect(result.current.range).toEqual(range);
    rerender({ locale: 'pt-BR' });
    expect(result.current.customStart).toBe('02-11-2026');
    expect(result.current.customEnd).toBe('09-11-2026');
    expect(result.current.range).toEqual(range);
    rerender({ locale: 'en' });
    expect(result.current.customStart).toBe('11/02/2026');
    expect(result.current.range).toEqual(range);
  });
});
