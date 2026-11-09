'use client';

import { useId, useMemo } from 'react';
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
import {
  RecurrenceIdentity,
  RecurringRowSurface,
  type RecurrenceCategory,
} from './recurring-row';
import { useRecurrenceCategoryFilter } from './use-recurrence-category-filter';
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
  category?: RecurrenceCategory;
  entry: PerformanceEntry;
  onOpen: (recurrenceId: string) => void;
}) {
  const { dictionary } = useAppContext();
  const formatCounts = useCountsLabel();
  const { performance, recurrence } = entry;

  return (
    <RecurringRowSurface isPriority={recurrence.priority}>
      <button
        type="button"
        aria-label={dictionary.recurring.openHistory.replace(
          '{name}',
          recurrence.text,
        )}
        className="flex min-h-11 w-full min-w-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
        onClick={() => onOpen(recurrence.id)}
      >
        <span className="flex min-w-0 flex-1 basis-56 touch:basis-full">
          <RecurrenceIdentity category={category} recurrence={recurrence} />
        </span>
        <span className="flex w-80 shrink-0 items-center gap-3 touch:w-full">
          <RateValue
            className="w-12 shrink-0 text-right text-base touch:text-left"
            rate={performance.rate}
          />
          <span className="w-32 shrink-0 text-xs whitespace-nowrap text-[#aebac8] tabular-nums">
            {formatCounts(performance)}
          </span>
          <PerformanceBar name={recurrence.text} rate={performance.rate} />
        </span>
      </button>
    </RecurringRowSurface>
  );
}

function PerformanceList({
  categoryTagMap,
  entries,
  filters,
  onOpen,
}: {
  categoryTagMap: Map<string, RecurrenceCategory>;
  entries: PerformanceEntry[];
  filters: PerformanceFilters;
  onOpen: (recurrenceId: string) => void;
}) {
  const labels = useAppContext().dictionary.recurring;
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={headingId}
          className="px-1 text-sm font-semibold text-[#fff9f2]"
        >
          {labels.performanceByActivity}
        </h2>
        <PerformanceSortFilter sort={filters.sort} onChange={filters.setSort} />
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {sortRecurrencePerformance(entries, filters.sort).map((entry) => (
          <PerformanceRow
            key={entry.recurrence.id}
            category={categoryTagMap.get(entry.recurrence.categoryTagId ?? '')}
            entry={entry}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
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
  const hasOccurrences = entries.some(
    (entry) => entry.performance.days.length > 0,
  );

  return (
    <div
      data-testid="task-list-surface"
      className={`flex flex-col gap-3 ${taskListSurfaceClassName}`}
    >
      <div className="flex flex-col gap-2 pb-1">
        <PerformancePeriodFilter filters={filters} />
        {categories.tabs.length > 0 ? (
          <TaskTreeCategoryTabs
            activeTabId={categories.activeTabId}
            label={dictionary.calendar.categoryTabs}
            tabs={categories.tabs}
            onSelect={filters.setCategoryTabId}
          />
        ) : null}
      </div>
      {filters.range && hasOccurrences ? (
        <>
          <PerformanceSummary
            name={labels.rateTitle}
            totals={summarizeRecurrencePerformance(
              entries.map((entry) => entry.performance),
            )}
          />
          <PerformanceList
            categoryTagMap={categories.categoryTagMap}
            entries={entries}
            filters={filters}
            onOpen={onOpen}
          />
        </>
      ) : filters.range ? (
        <p className={performanceMessageClassName}>{labels.performanceEmpty}</p>
      ) : null}
    </div>
  );
}
