'use client';

import { DatePicker } from '@/components/app';
import { getProgressTone } from '@/features/calendar/calendar-progress-tone';
import { neutralProgressTrackStyle } from '@/features/goals/goal-card-styles';
import type {
  RecurrencePerformanceTotals,
  RecurrencePerformanceSort,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurringPillGroup } from './recurring-pill-group';
import type {
  PerformanceFilters,
  PerformancePeriod,
} from './use-performance-filters';

export const performanceMessageClassName =
  'py-6 text-center text-sm text-[#aebac8]';

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate)}%`;
}

export function useCountsLabel() {
  const labels = useAppContext().dictionary.recurring;

  return ({ done, notDone }: { done: number; notDone: number }) =>
    labels.countsSummary
      .replace(
        '{done}',
        done === 1
          ? labels.doneCountOne
          : labels.doneCount.replace('{count}', String(done)),
      )
      .replace(
        '{notDone}',
        notDone === 1
          ? labels.notDoneCountOne
          : labels.notDoneCount.replace('{count}', String(notDone)),
      );
}

export function PerformanceBar({
  name,
  rate,
}: {
  name: string;
  rate: number | null;
}) {
  const labels = useAppContext().dictionary.recurring;

  if (rate === null) {
    return (
      <span
        className="block h-1.5 min-w-0 flex-1 rounded-full"
        style={neutralProgressTrackStyle}
      />
    );
  }

  const percent = Math.round(rate);

  return (
    <span
      role="progressbar"
      aria-label={labels.rateLabel.replace('{name}', name)}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
      style={neutralProgressTrackStyle}
    >
      <span
        className="block h-full rounded-full"
        style={{
          ...getProgressTone(percent / 100).fillStyle,
          width: `${percent}%`,
        }}
      />
    </span>
  );
}

export function RateValue({
  className = '',
  rate,
}: {
  className?: string;
  rate: number | null;
}) {
  const labels = useAppContext().dictionary.recurring;

  return rate === null ? (
    <span
      role="img"
      aria-label={labels.noData}
      className={`font-semibold text-[#aebac8] ${className}`}
    >
      —
    </span>
  ) : (
    <span className={`font-semibold text-[#f7d7ad] tabular-nums ${className}`}>
      {formatRate(rate)}
    </span>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="truncate text-xs text-[#aebac8]">{label}</dt>
      <dd className="text-lg font-semibold text-[#fff9f2] tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function PerformanceSummary({
  name,
  totals,
}: {
  name: string;
  totals: RecurrencePerformanceTotals;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="flex flex-col">
          <span className="text-xs text-[#aebac8]">{labels.rateTitle}</span>
          <RateValue className="text-3xl" rate={totals.rate} />
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1 pb-2">
          <PerformanceBar name={name} rate={totals.rate} />
          <p className="text-xs text-[#aebac8]">{labels.rateHint}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryMetric label={labels.doneTitle} value={totals.done} />
        <SummaryMetric label={labels.notDoneTitle} value={totals.notDone} />
        <SummaryMetric
          label={labels.unregisteredTitle}
          value={totals.unregistered}
        />
        <SummaryMetric label={labels.pendingTitle} value={totals.pending} />
      </dl>
      <p className="text-xs text-[#aebac8]">
        {labels.coverageLabel.replace('{value}', formatRate(totals.coverage))}
      </p>
    </div>
  );
}

export function PerformancePeriodFilter({
  filters,
}: {
  filters: PerformanceFilters;
}) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const options: { label: string; value: PerformancePeriod }[] = [
    { label: labels.last7Days, value: '7' },
    { label: labels.last30Days, value: '30' },
    { label: labels.last90Days, value: '90' },
    { label: labels.customPeriod, value: 'custom' },
  ];
  const error =
    filters.rangeError === 'order' ? labels.rangeOrder : labels.rangeInvalid;

  return (
    <div className="flex flex-col gap-2">
      <RecurringPillGroup
        label={labels.periodLabel}
        options={options}
        value={filters.period}
        onChange={filters.setPeriod}
      />
      {filters.period === 'custom' ? (
        <div className="grid gap-2 sm:max-w-xl sm:grid-cols-2">
          <DatePicker
            label={labels.startDateLabel}
            placeholder={dictionary.calendar.bulkDatePlaceholder}
            value={filters.customStart}
            onChange={filters.setCustomStart}
          />
          <DatePicker
            label={labels.endDateLabel}
            placeholder={dictionary.calendar.bulkDatePlaceholder}
            value={filters.customEnd}
            onChange={filters.setCustomEnd}
          />
          {filters.rangeError ? (
            <p
              role="alert"
              className="px-1 text-xs text-rose-300 sm:col-span-2"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PerformanceSortFilter({
  sort,
  onChange,
}: {
  sort: RecurrencePerformanceSort;
  onChange: (sort: RecurrencePerformanceSort) => void;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <RecurringPillGroup
      label={labels.sortLabel}
      options={[
        { label: labels.sortName, value: 'name' },
        { label: labels.sortHighest, value: 'highest' },
        { label: labels.sortLowest, value: 'lowest' },
      ]}
      value={sort}
      onChange={onChange}
    />
  );
}
