'use client';

import { ArrowLeft, Repeat, Star } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import {
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
} from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { toAlphaColor } from '@/lib/color';
import {
  isRecurrencePaused,
  type LocalDateString,
  type Recurrence,
  type RecurrencePerformance,
  type RecurrencePerformanceDay,
  type RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { formatRecurringDate } from './recurrence-format';
import { RecurringHistoryCalendar } from './recurring-history-calendar';
import { useRecurrencePerformance } from './recurring-performance';
import {
  PerformancePeriodFilter,
  PerformanceSummary,
  QuantitySummaryPanels,
  performanceMessageClassName,
  performanceStatusAppearance,
  useDayQuantityText,
  useStatusLabel,
} from './recurring-performance-parts';
import { RecurringMeasuredSubtasks } from './recurring-measured-subtasks';
import { PausedBadge, useRecurrenceFrequency } from './recurring-row';
import type { PerformanceFilters } from './use-performance-filters';

const historyPageSize = 30;

const detailPillClassName =
  'inline-flex min-h-9 max-w-full shrink-0 items-center rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-3 py-1 text-sm font-medium shadow-sm shadow-[#253241]/10';

function DetailHeader({
  recurrence,
  onBack,
}: {
  recurrence: Recurrence;
  onBack: () => void;
}) {
  const { dictionary, scope } = useAppContext();
  const frequency = useRecurrenceFrequency(recurrence);
  const category = useCategoryTags(scope, 'recurrence').find(
    (tag) => tag.id === recurrence.categoryTagId,
  );

  return (
    <header className="flex flex-col gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:px-0">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {recurrence.priority ? (
            <Star
              aria-label={dictionary.recurring.priority}
              className="mt-1.5 size-5 shrink-0 fill-[#f0c38e] text-[#f0c38e] touch:mt-1 touch:size-4"
              role="img"
            />
          ) : null}
          <h2
            className={`min-w-0 text-2xl text-balance wrap-anywhere text-[#fff9f2] touch:text-lg ${
              recurrence.bold ? 'font-bold' : 'font-semibold'
            }`}
          >
            {recurrence.text}
          </h2>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
          {frequency ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 px-1 text-sm text-[#cbd5e0]">
              <Repeat
                aria-hidden="true"
                className="size-3.5 shrink-0 opacity-70"
              />
              <span className="truncate">{frequency}</span>
            </span>
          ) : null}
          {isRecurrencePaused(recurrence.schedule) ? <PausedBadge /> : null}
        </div>
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

function HistoryItem({
  day,
  isSelected,
}: {
  day: RecurrencePerformanceDay;
  isSelected: boolean;
}) {
  const { locale } = useAppContext();
  const getStatusLabel = useStatusLabel();
  const quantityText = useDayQuantityText()(day.quantity);
  const { Icon, className } = performanceStatusAppearance[day.status];

  return (
    <li
      aria-current={isSelected ? 'date' : undefined}
      className={`flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-1.5 transition ${
        isSelected ? 'bg-[#f0c38e]/[0.12]' : 'bg-white/[0.035]'
      }`}
      data-history-date={day.date}
    >
      <span className="min-w-0 text-sm text-[#e5ebf3] first-letter:uppercase">
        {formatRecurringDate(day.date, locale)}
      </span>
      {quantityText ? (
        <span className="ml-auto text-xs whitespace-nowrap text-[#cbd5e0] tabular-nums">
          {quantityText}
        </span>
      ) : null}
      <span
        className={`flex shrink-0 items-center gap-1.5 text-sm ${className}`}
      >
        <Icon aria-hidden="true" className="size-4" />
        {getStatusLabel(day.status)}
      </span>
    </li>
  );
}

function HistoryList({
  days,
  selectedDate,
}: {
  days: RecurrencePerformanceDay[];
  selectedDate: LocalDateString | null;
}) {
  const labels = useAppContext().dictionary.recurring;
  const [requestedCount, setRequestedCount] = useState(historyPageSize);
  const selectedIndex = days.findIndex((day) => day.date === selectedDate);
  const visibleCount = Math.max(requestedCount, selectedIndex + 1);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-[#fff9f2]">
        {labels.historyTitle}
      </h2>
      {days.length === 0 ? (
        <p className={performanceMessageClassName}>{labels.historyEmpty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1">
          {days.slice(0, visibleCount).map((day) => (
            <HistoryItem
              key={day.date}
              day={day}
              isSelected={day.date === selectedDate}
            />
          ))}
        </ul>
      )}
      {visibleCount < days.length ? (
        <button
          type="button"
          className={`${filledMediumPillControlClassName} w-fit self-center`}
          onClick={() => setRequestedCount(visibleCount + historyPageSize)}
        >
          {labels.showMore}
        </button>
      ) : null}
    </section>
  );
}

function scrollToHistoryDate(date: LocalDateString) {
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-history-date="${date}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  });
}

function DetailResults({
  days,
  performance,
  range,
  recurrence,
  responses,
  selectedDate,
  today,
  onSelect,
}: {
  days: RecurrencePerformanceDay[];
  performance: RecurrencePerformance;
  range: { endDate: LocalDateString; startDate: LocalDateString };
  recurrence: Recurrence;
  responses: RecurrenceResponse[];
  selectedDate: LocalDateString | null;
  today: LocalDateString;
  onSelect: (date: LocalDateString) => void;
}) {
  const rangeKey = `${range.startDate}:${range.endDate}`;

  return (
    <>
      <PerformanceSummary name={recurrence.text} totals={performance} />
      {performance.quantities.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 touch:grid-cols-1">
          <QuantitySummaryPanels
            name={recurrence.text}
            summaries={performance.quantities}
          />
        </div>
      ) : null}
      <RecurringMeasuredSubtasks
        range={range}
        recurrence={recurrence}
        responses={responses}
        today={today}
      />
      <div className="grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start gap-3 touch:grid-cols-1">
        <RecurringHistoryCalendar
          key={`calendar:${rangeKey}`}
          performance={performance}
          range={range}
          recurrence={recurrence}
          selectedDate={selectedDate}
          today={today}
          onSelect={onSelect}
        />
        <HistoryList
          key={`history:${rangeKey}`}
          days={days}
          selectedDate={selectedDate}
        />
      </div>
    </>
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
  const [selectedDate, setSelectedDate] = useState<LocalDateString | null>(
    null,
  );
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

  function selectDate(date: LocalDateString) {
    setSelectedDate(date);
    scrollToHistoryDate(date);
  }

  return (
    <div className="flex flex-col gap-3">
      <DetailHeader recurrence={recurrence} onBack={onBack} />
      <div
        data-testid="task-list-surface"
        className={`flex flex-col gap-3 ${taskListSurfaceClassName}`}
      >
        <PerformancePeriodFilter filters={filters} />
        {entry && filters.range ? (
          <DetailResults
            days={days}
            performance={entry.performance}
            range={filters.range}
            recurrence={recurrence}
            responses={responses}
            selectedDate={selectedDate}
            today={today}
            onSelect={selectDate}
          />
        ) : null}
      </div>
    </div>
  );
}
