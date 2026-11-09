'use client';

import {
  ArrowLeft,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Repeat,
  Star,
} from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import {
  Tooltip,
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
} from '@/components/ui';
import { toAlphaColor } from '@/lib/color';
import { useCategoryTags } from '@/features/categories';
import type {
  Recurrence,
  RecurrencePerformanceDay,
  RecurrencePerformanceStatus,
  RecurrenceResponse,
  LocalDateString,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import {
  formatRecurrenceFrequency,
  formatRecurringDate,
} from './recurrence-format';
import {
  PerformancePeriodFilter,
  PerformanceSummary,
  performanceMessageClassName,
} from './recurring-performance-parts';
import { useRecurrencePerformance } from './recurring-performance';
import type { PerformanceFilters } from './use-performance-filters';

const detailPillClassName =
  'inline-flex min-h-9 max-w-full shrink-0 items-center rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-3 py-1 text-sm font-medium shadow-sm shadow-[#253241]/10';

const statusAppearance = {
  done: { Icon: CircleCheck, className: 'text-emerald-300' },
  not_done: { Icon: CircleX, className: 'text-rose-300' },
  pending: { Icon: Clock, className: 'text-[#f0c38e]' },
  unregistered: { Icon: CircleDashed, className: 'text-[#aebac8]' },
} satisfies Record<RecurrencePerformanceStatus, unknown>;

function useStatusLabel() {
  const labels = useAppContext().dictionary.recurring;
  const statusLabels: Record<RecurrencePerformanceStatus, string> = {
    done: labels.statusDone,
    not_done: labels.statusNotDone,
    pending: labels.statusPending,
    unregistered: labels.statusUnregistered,
  };

  return (status: RecurrencePerformanceStatus) => statusLabels[status];
}

function HistoryItem({ day }: { day: RecurrencePerformanceDay }) {
  const { locale } = useAppContext();
  const getStatusLabel = useStatusLabel();
  const { Icon, className } = statusAppearance[day.status];

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2">
      <span className="min-w-0 truncate text-sm text-[#e5ebf3]">
        {formatRecurringDate(day.date, locale)}
      </span>
      <span
        className={`flex shrink-0 items-center gap-1.5 text-sm ${className}`}
      >
        <Icon aria-hidden="true" className="size-4" />
        {getStatusLabel(day.status)}
      </span>
    </li>
  );
}

function DetailHeader({
  recurrence,
  onBack,
}: {
  recurrence: Recurrence;
  onBack: () => void;
}) {
  const { dictionary, scope } = useAppContext();
  const labels = dictionary.recurring;
  const category = useCategoryTags(scope, 'recurrence').find(
    (tag) => tag.id === recurrence.categoryTagId,
  );

  return (
    <header className="flex flex-col gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2 sm:px-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          {recurrence.priority ? (
            <Star
              aria-label={labels.priority}
              className="size-5 shrink-0 fill-[#f0c38e] text-[#f0c38e]"
              role="img"
            />
          ) : null}
          <Tooltip className="min-w-0" content={recurrence.text} whenTruncated>
            <h2
              className={`min-w-0 truncate text-2xl text-[#fff9f2] touch:text-lg ${
                recurrence.bold ? 'font-bold' : 'font-semibold'
              }`}
            >
              {recurrence.text}
            </h2>
          </Tooltip>
        </div>
        {category ? (
          <span
            className={`${detailPillClassName} text-[#f7e8ce]`}
            style={
              {
                '--chip-edge': toAlphaColor(category.colorHex, 0.6),
                backgroundColor: toAlphaColor(category.colorHex, 0.14),
              } as CSSProperties
            }
          >
            <span className="truncate">{category.name}</span>
          </span>
        ) : null}
        <span
          className={`${detailPillClassName} gap-1.5 bg-white/5 text-[#f8f3ea] [--chip-edge:rgb(255_255_255/0.15)]`}
        >
          <Repeat aria-hidden="true" className="size-3.5 opacity-70" />
          <span className="truncate">
            {formatRecurrenceFrequency(recurrence, dictionary)}
          </span>
        </span>
      </div>
      <button
        type="button"
        className={`${filledMediumPillControlClassName} w-fit`}
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {dictionary.actions.back}
      </button>
    </header>
  );
}

export function RecurringPerformanceDetail({
  filters,
  recurrence,
  responses,
  today,
  onBack,
}: {
  filters: PerformanceFilters;
  recurrence: Recurrence;
  responses: RecurrenceResponse[];
  today: LocalDateString;
  onBack: () => void;
}) {
  const labels = useAppContext().dictionary.recurring;
  const recurrences = useMemo(() => [recurrence], [recurrence]);
  const responsesByRecurrence = useMemo(
    () => new Map([[recurrence.id, responses]]),
    [recurrence.id, responses],
  );
  const [entry] = useRecurrencePerformance({
    range: filters.range,
    recurrences,
    responsesByRecurrence,
    today,
  });
  const days = entry ? [...entry.performance.days].reverse() : [];

  return (
    <div className="flex flex-col gap-3">
      <DetailHeader recurrence={recurrence} onBack={onBack} />
      <div
        data-testid="task-list-surface"
        className={`flex flex-col gap-3 ${taskListSurfaceClassName}`}
      >
        <PerformancePeriodFilter filters={filters} />
        {entry ? (
          <PerformanceSummary
            name={recurrence.text}
            totals={entry.performance}
          />
        ) : null}
        <h2 className="px-3 text-sm font-semibold text-[#fff9f2]">
          {labels.historyTitle}
        </h2>
        {days.length > 0 ? (
          <ul className="grid grid-cols-1 gap-0.5">
            {days.map((day) => (
              <HistoryItem key={day.date} day={day} />
            ))}
          </ul>
        ) : filters.range ? (
          <p className={performanceMessageClassName}>{labels.historyEmpty}</p>
        ) : null}
      </div>
    </div>
  );
}
