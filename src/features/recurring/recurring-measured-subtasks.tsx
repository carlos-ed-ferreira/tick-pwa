'use client';

import { useMemo } from 'react';
import {
  computeRecurrencePerformance,
  type LocalDateString,
  type Recurrence,
  type RecurrencePerformance,
  type RecurrenceResponse,
} from '@/lib/domain';
import { formatQuantity } from '@/lib/i18n';
import { toLocalDateKey } from '@/lib/time';
import { useAppContext } from '@/providers';
import {
  PerformanceBar,
  RateValue,
  useCountsLabel,
} from './recurring-performance-parts';

type PerformanceRange = {
  endDate: LocalDateString;
  startDate: LocalDateString;
};

function MeasuredSubtaskItem({
  name,
  performance,
}: {
  name: string;
  performance: RecurrencePerformance;
}) {
  const { dictionary, locale } = useAppContext();
  const labels = dictionary.recurring;
  const formatCounts = useCountsLabel();
  const [summary] = performance.quantities;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white/[0.035] px-3 py-2">
      <span className="min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-[#fff9f2]">
        {name}
      </span>
      <span className="text-xs whitespace-nowrap text-[#aebac8] tabular-nums">
        {formatCounts({ ...performance, quantitative: true })}
      </span>
      <span className="flex w-56 shrink-0 items-center gap-2 touch:w-full">
        <RateValue
          className="w-12 shrink-0 text-right text-sm touch:text-left"
          rate={summary?.progress ?? null}
        />
        <PerformanceBar
          label={labels.quantityProgressLabel.replace('{name}', name)}
          name={name}
          rate={summary?.progress ?? null}
        />
      </span>
      {summary ? (
        <span className="basis-full text-xs text-[#aebac8]">
          {labels.quantityRealized
            .replace('{value}', formatQuantity(summary.realized, locale))
            .replace('{unit}', summary.unit)}
        </span>
      ) : null}
    </li>
  );
}

export function RecurringMeasuredSubtasks({
  range,
  recurrence,
  responses,
  today,
}: {
  range: PerformanceRange;
  recurrence: Recurrence;
  responses: readonly RecurrenceResponse[];
  today: LocalDateString;
}) {
  const { dictionary, timezonePreference } = useAppContext();
  const labels = dictionary.recurring;
  const entries = useMemo(
    () =>
      recurrence.children
        .filter((child) => child.measure)
        .map((child) => ({
          child,
          performance: computeRecurrencePerformance({
            createdDate: toLocalDateKey(
              new Date(recurrence.createdAt),
              timezonePreference.timezone,
            ),
            endDate: range.endDate,
            itemId: child.id,
            recurrence,
            responses,
            startDate: range.startDate,
            today,
          }),
        })),
    [range, recurrence, responses, timezonePreference.timezone, today],
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-[#fff9f2]">
        {labels.childQuantitiesTitle}
      </h2>
      <ul className="grid grid-cols-1 gap-1">
        {entries.map(({ child, performance }) => (
          <MeasuredSubtaskItem
            key={child.id}
            name={child.text}
            performance={performance}
          />
        ))}
      </ul>
    </section>
  );
}
