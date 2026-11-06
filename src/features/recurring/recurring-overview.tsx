'use client';

import { Plus, Star } from 'lucide-react';
import { useMemo } from 'react';
import { TaskTreeCategoryChip } from '@/components/app';
import {
  Tooltip,
  filledAccentPillControlClassName,
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
} from '@/components/ui';
import { getProgressTone } from '@/features/calendar/calendar-progress-tone';
import { CategoryManagerAction, useCategoryTags } from '@/features/categories';
import { neutralProgressTrackStyle } from '@/features/goals/goal-card-styles';
import {
  computeRecurrenceStats,
  isRecurrencePaused,
  type LocalDateString,
  type Recurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurrenceActions } from './recurrence-actions';
import { formatRecurrenceFrequency } from './recurrence-format';

function RecurrenceRate({
  done,
  name,
  notDone,
  rate,
}: {
  done: number;
  name: string;
  notDone: number;
  rate: number | null;
}) {
  const labels = useAppContext().dictionary.recurring;
  const percent = rate === null ? null : Math.round(rate);
  const countsLabel = labels.countsSummary
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

  return (
    <div className="flex w-64 shrink-0 items-center gap-3 touch:w-full">
      {percent === null ? (
        <span
          role="img"
          aria-label={labels.noData}
          className="w-12 shrink-0 text-right text-base font-semibold text-[#aebac8] touch:w-auto touch:text-left"
        >
          -%
        </span>
      ) : (
        <span className="w-12 shrink-0 text-right text-base font-semibold text-[#f7d7ad] touch:w-auto touch:text-left">
          {percent}%
        </span>
      )}
      <Tooltip content={countsLabel}>
        <span
          role="img"
          aria-label={countsLabel}
          className="w-12 shrink-0 text-xs tabular-nums whitespace-nowrap text-[#aebac8] touch:w-auto"
        >
          {done}/{notDone}
        </span>
      </Tooltip>
      {percent === null ? (
        <span
          className="block h-1.5 min-w-0 flex-1 rounded-full"
          style={neutralProgressTrackStyle}
        />
      ) : (
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
      )}
    </div>
  );
}

function RecurrenceRow({
  category,
  recurrence,
  responses,
  today,
  onEdit,
}: {
  category?: { colorHex: string; name: string };
  recurrence: Recurrence;
  responses: RecurrenceResponse[];
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { dictionary } = useAppContext();
  const { done, notDone, rate } = computeRecurrenceStats(responses);

  return (
    <li
      className={`relative flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg py-2 pr-30 pl-3 transition hover:bg-white/[0.055] ${
        isRecurrencePaused(recurrence.schedule) ? 'opacity-70' : ''
      }`}
    >
      <div className="min-w-0 flex-1 basis-52">
        <div className="flex min-w-0 items-center gap-2">
          {recurrence.priority ? (
            <Star
              aria-label={dictionary.recurring.priority}
              className="size-3.5 shrink-0 fill-[#f0c38e] text-[#f0c38e]"
              role="img"
            />
          ) : null}
          <Tooltip className="min-w-0" content={recurrence.text} whenTruncated>
            <span
              className={`min-w-0 truncate text-sm text-[#fff9f2] ${
                recurrence.bold ? 'font-bold' : 'font-medium'
              }`}
            >
              {recurrence.text}
            </span>
          </Tooltip>
          {category ? (
            <TaskTreeCategoryChip
              colorHex={category.colorHex}
              name={category.name}
            />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-[#cbd5e0]">
          {formatRecurrenceFrequency(recurrence, dictionary)}
        </p>
      </div>
      <RecurrenceRate
        done={done}
        name={recurrence.text}
        notDone={notDone}
        rate={rate}
      />
      <span className="absolute top-1/2 right-2 -translate-y-1/2 touch:top-2.5 touch:translate-y-0">
        <RecurrenceActions
          answerCount={responses.length}
          recurrence={recurrence}
          today={today}
          onEdit={onEdit}
        />
      </span>
    </li>
  );
}

function compareOverview(left: Recurrence, right: Recurrence): number {
  return (
    Number(isRecurrencePaused(left.schedule)) -
      Number(isRecurrencePaused(right.schedule)) ||
    left.createdAt.localeCompare(right.createdAt)
  );
}

export function RecurringManageActions({ onCreate }: { onCreate: () => void }) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CategoryManagerAction
        className={filledMediumPillControlClassName}
        surface="recurrence"
        title={labels.categoriesTitle}
      />
      <button
        type="button"
        className={filledAccentPillControlClassName}
        onClick={onCreate}
      >
        <Plus aria-hidden="true" className="size-4" />
        {labels.newActivity}
      </button>
    </div>
  );
}

export function RecurringOverviewList({
  recurrences,
  responsesByRecurrence,
  today,
  onEdit,
}: {
  recurrences: Recurrence[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, 'recurrence');
  const categoryTagMap = useMemo(
    () => new Map(categoryTags.map((tag) => [tag.id, tag])),
    [categoryTags],
  );
  const ordered = useMemo(
    () => [...recurrences].sort(compareOverview),
    [recurrences],
  );

  return (
    <ul
      data-testid="task-list-surface"
      className={`grid grid-cols-1 gap-1 ${taskListSurfaceClassName}`}
    >
      {ordered.map((recurrence) => (
        <RecurrenceRow
          key={recurrence.id}
          category={categoryTagMap.get(recurrence.categoryTagId ?? '')}
          recurrence={recurrence}
          responses={responsesByRecurrence.get(recurrence.id) ?? []}
          today={today}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}
