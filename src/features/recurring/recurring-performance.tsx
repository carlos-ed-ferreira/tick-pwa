'use client';

import { useMemo } from 'react';
import { TaskTreeCategoryTabs } from '@/components/app';
import { taskListSurfaceClassName } from '@/components/ui';
import {
  computeRecurrencePerformance,
  sortRecurrencePerformance,
  summarizeRecurrencePerformance,
  type LocalDateString,
  type Recurrence,
  type RecurrencePerformance,
  type RecurrenceResponse,
} from '@/lib/domain';
import { toLocalDateKey } from '@/lib/time';
import { useAppContext } from '@/providers';
import { formatRecurrenceFrequency } from './recurrence-format';
import {
  RecurrenceNameLine,
  useRecurrenceCategoryFilter,
} from './recurring-activities';
import {
  PerformanceBar,
  PerformancePeriodFilter,
  PerformanceSortFilter,
  PerformanceSummary,
  RateValue,
  performanceMessageClassName,
  useCountsLabel,
} from './recurring-performance-parts';
import type { PerformanceFilters } from './use-performance-filters';

export interface PerformanceEntry {
  name: string;
  performance: RecurrencePerformance;
  recurrence: Recurrence;
}

export function useRecurrencePerformance({
  range,
  recurrences,
  responsesByRecurrence,
  today,
}: {
  range: PerformanceFilters['range'];
  recurrences: readonly Recurrence[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
}): PerformanceEntry[] {
  const { timezone } = useAppContext().timezonePreference;

  return useMemo(
    () =>
      range
        ? recurrences.map((recurrence) => ({
            name: recurrence.text,
            performance: computeRecurrencePerformance({
              createdDate: toLocalDateKey(
                new Date(recurrence.createdAt),
                timezone,
              ),
              endDate: range.endDate,
              recurrence,
              responses: responsesByRecurrence.get(recurrence.id) ?? [],
              startDate: range.startDate,
              today,
            }),
            recurrence,
          }))
        : [],
    [range, recurrences, responsesByRecurrence, timezone, today],
  );
}

function PerformanceRow({
  category,
  entry,
  onOpen,
}: {
  category?: { colorHex: string; name: string };
  entry: PerformanceEntry;
  onOpen: (recurrenceId: string) => void;
}) {
  const { dictionary } = useAppContext();
  const formatCounts = useCountsLabel();
  const { performance, recurrence } = entry;

  return (
    <li>
      <button
        type="button"
        aria-label={dictionary.recurring.openHistory.replace(
          '{name}',
          recurrence.text,
        )}
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.055] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
        onClick={() => onOpen(recurrence.id)}
      >
        <span className="flex min-w-0 flex-1 basis-56 flex-col">
          <RecurrenceNameLine category={category} recurrence={recurrence} />
          <span className="mt-0.5 truncate text-xs text-[#cbd5e0]">
            {formatRecurrenceFrequency(recurrence, dictionary)}
          </span>
        </span>
        <span className="flex w-80 max-w-full shrink-0 items-center gap-3 touch:w-full">
          <RateValue
            className="w-12 shrink-0 text-right text-base"
            rate={performance.rate}
          />
          <span className="w-32 shrink-0 text-xs whitespace-nowrap text-[#aebac8] tabular-nums">
            {formatCounts(performance)}
          </span>
          <PerformanceBar name={recurrence.text} rate={performance.rate} />
        </span>
      </button>
    </li>
  );
}

export function RecurringPerformanceView({
  filters,
  recurrences,
  responsesByRecurrence,
  today,
  onOpen,
}: {
  filters: PerformanceFilters;
  recurrences: Recurrence[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
  onOpen: (recurrenceId: string) => void;
}) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const categories = useRecurrenceCategoryFilter(
    recurrences,
    filters.categoryTabId,
  );
  const entries = useRecurrencePerformance({
    range: filters.range,
    recurrences: categories.visible,
    responsesByRecurrence,
    today,
  });
  const sorted = sortRecurrencePerformance(entries, filters.sort);
  const hasOccurrences = entries.some(
    (entry) => entry.performance.days.length > 0,
  );

  return (
    <div
      data-testid="task-list-surface"
      className={`flex flex-col gap-3 ${taskListSurfaceClassName}`}
    >
      <PerformancePeriodFilter filters={filters} />
      {categories.tabs.length > 0 ? (
        <TaskTreeCategoryTabs
          activeTabId={categories.activeTabId}
          label={dictionary.calendar.categoryTabs}
          tabs={categories.tabs}
          onSelect={filters.setCategoryTabId}
        />
      ) : null}
      {filters.range && hasOccurrences ? (
        <>
          <PerformanceSummary
            name={labels.rateTitle}
            totals={summarizeRecurrencePerformance(
              entries.map((entry) => entry.performance),
            )}
          />
          <PerformanceSortFilter
            sort={filters.sort}
            onChange={filters.setSort}
          />
          <ul className="grid grid-cols-1 gap-1">
            {sorted.map((entry) => (
              <PerformanceRow
                key={entry.recurrence.id}
                category={categories.categoryTagMap.get(
                  entry.recurrence.categoryTagId ?? '',
                )}
                entry={entry}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </>
      ) : filters.range ? (
        <p className={performanceMessageClassName}>{labels.performanceEmpty}</p>
      ) : null}
    </div>
  );
}
