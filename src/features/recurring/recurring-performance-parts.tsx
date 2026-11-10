'use client';

import {
  ChartPie,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { DatePicker } from '@/components/app';
import { getProgressTone } from '@/features/calendar/calendar-progress-tone';
import { neutralProgressTrackStyle } from '@/features/goals/goal-card-styles';
import { formatQuantity } from '@/lib/i18n';
import {
  getQuantityProgress,
  type RecurrenceCalendarStatus,
  type RecurrenceQuantity,
  type RecurrenceQuantitySummary,
  type RecurrencePerformanceStatus,
  type RecurrencePerformanceTotals,
  type RecurrencePerformanceSort,
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
  const doneLabel = (done: number) =>
    done === 1
      ? labels.doneCountOne
      : labels.doneCount.replace('{count}', String(done));

  return ({
    done,
    notDone,
    partial = 0,
    quantitative = false,
  }: {
    done: number;
    notDone: number;
    partial?: number;
    quantitative?: boolean;
  }) =>
    quantitative
      ? labels.quantityCountsSummary
          .replace('{done}', doneLabel(done))
          .replace(
            '{partial}',
            partial === 1
              ? labels.partialCountOne
              : labels.partialCount.replace('{count}', String(partial)),
          )
          .replace(
            '{zero}',
            notDone === 1
              ? labels.zeroCountOne
              : labels.zeroCount.replace('{count}', String(notDone)),
          )
      : labels.countsSummary
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
  label,
  name,
  rate,
}: {
  label?: string;
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
      aria-label={label ?? labels.rateLabel.replace('{name}', name)}
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

export const performanceStatusAppearance = {
  done: { Icon: CircleCheck, className: 'text-emerald-300' },
  future: { Icon: CircleDot, className: 'text-[#7b8da0]' },
  none: { Icon: Minus, className: 'text-[#5d6b7a]' },
  not_done: { Icon: CircleX, className: 'text-rose-300' },
  outside: { Icon: Minus, className: 'text-[#3e4955]' },
  partial: { Icon: ChartPie, className: 'text-amber-300' },
  pending: { Icon: Clock, className: 'text-[#f0c38e]' },
  unregistered: { Icon: CircleDashed, className: 'text-[#aebac8]' },
} satisfies Record<
  RecurrenceCalendarStatus,
  { Icon: LucideIcon; className: string }
>;

export function useStatusLabel() {
  const labels = useAppContext().dictionary.recurring;
  const statusLabels: Record<RecurrenceCalendarStatus, string> = {
    done: labels.statusDone,
    future: labels.statusFuture,
    none: labels.statusNone,
    not_done: labels.statusNotDone,
    outside: labels.statusOutside,
    partial: labels.statusPartial,
    pending: labels.statusPending,
    unregistered: labels.statusUnregistered,
  };

  return (status: RecurrenceCalendarStatus) => statusLabels[status];
}

function useSampleLabels(totals: RecurrencePerformanceTotals) {
  const labels = useAppContext().dictionary.recurring;
  const answered = totals.done + totals.notDone + totals.partial;
  const eligible = answered + totals.unregistered;
  const rate =
    answered === 0
      ? labels.rateHint
      : (answered === 1 ? labels.rateSampleOne : labels.rateSampleMany)
          .replace('{done}', String(totals.done))
          .replace('{count}', String(answered));
  const coverage =
    eligible === 0
      ? labels.noResults
      : (eligible === 1 ? labels.coverageSampleOne : labels.coverageSampleMany)
          .replace('{answered}', String(answered))
          .replace('{count}', String(eligible));

  return { coverage, rate };
}

function PrimaryMetric({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-white/[0.035] px-4 py-3">
      <span className="text-xs font-medium text-[#aebac8]">{label}</span>
      {children}
      <span className="text-xs text-[#aebac8]">{hint}</span>
    </div>
  );
}

function SecondaryMetric({
  label,
  status,
  value,
}: {
  label: string;
  status: RecurrencePerformanceStatus;
  value: number;
}) {
  const { Icon, className } = performanceStatusAppearance[status];

  return (
    <div className="flex min-w-0 items-center gap-2 px-1">
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${className}`} />
      <dt className="min-w-0 truncate text-xs text-[#aebac8]">{label}</dt>
      <dd className="ml-auto text-sm font-semibold text-[#fff9f2] tabular-nums">
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
  const samples = useSampleLabels(totals);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 touch:grid-cols-1">
        <PrimaryMetric hint={samples.rate} label={labels.rateTitle}>
          <span className="flex items-center gap-3">
            <RateValue className="text-3xl" rate={totals.rate} />
            <PerformanceBar name={name} rate={totals.rate} />
          </span>
        </PrimaryMetric>
        <PrimaryMetric hint={samples.coverage} label={labels.coverageTitle}>
          <RateValue className="text-3xl" rate={totals.coverage} />
        </PrimaryMetric>
      </div>
      <dl
        className={`grid gap-x-4 gap-y-2 touch:grid-cols-2 ${
          totals.partial > 0 ? 'grid-cols-5' : 'grid-cols-4'
        }`}
      >
        <SecondaryMetric
          label={labels.doneTitle}
          status="done"
          value={totals.done}
        />
        {totals.partial > 0 ? (
          <SecondaryMetric
            label={labels.partialTitle}
            status="partial"
            value={totals.partial}
          />
        ) : null}
        <SecondaryMetric
          label={labels.notDoneTitle}
          status="not_done"
          value={totals.notDone}
        />
        <SecondaryMetric
          label={labels.unregisteredTitle}
          status="unregistered"
          value={totals.unregistered}
        />
        <SecondaryMetric
          label={labels.pendingTitle}
          status="pending"
          value={totals.pending}
        />
      </dl>
    </div>
  );
}

export function useDayQuantityText() {
  const { dictionary, locale } = useAppContext();

  return (quantity: RecurrenceQuantity | null) =>
    quantity
      ? `${dictionary.recurring.quantityProgress
          .replace('{value}', formatQuantity(quantity.value, locale))
          .replace('{target}', formatQuantity(quantity.target, locale))
          .replace('{unit}', quantity.unit)} · ${Math.round(
          getQuantityProgress(quantity) * 100,
        )}%`
      : null;
}

export function QuantitySummaryPanels({
  name,
  summaries,
}: {
  name: string;
  summaries: readonly RecurrenceQuantitySummary[];
}) {
  const { dictionary, locale } = useAppContext();
  const labels = dictionary.recurring;

  return summaries.map((summary) => {
    const format = (value: number) => formatQuantity(value, locale);

    return (
      <PrimaryMetric
        key={summary.unit}
        hint={labels.quantityExpected
          .replace('{capped}', format(summary.capped))
          .replace('{expected}', format(summary.expected))
          .replace('{unit}', summary.unit)}
        label={labels.quantityProgressTitle}
      >
        <span className="flex items-center gap-3">
          <RateValue className="text-3xl" rate={summary.progress} />
          <PerformanceBar
            label={labels.quantityProgressLabel.replace('{name}', name)}
            name={name}
            rate={summary.progress}
          />
        </span>
        <span className="text-sm text-[#e5ebf3]">
          {labels.quantityRealized
            .replace('{value}', format(summary.realized))
            .replace('{unit}', summary.unit)}
        </span>
      </PrimaryMetric>
    );
  });
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
      <div className="flex min-w-0 items-center gap-2">
        <RecurringPillGroup
          label={labels.periodLabel}
          options={options}
          value={filters.period}
          onChange={filters.setPeriod}
        />
      </div>
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
