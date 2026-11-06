'use client';

import { Plus, Star } from 'lucide-react';
import { useMemo } from 'react';
import { TaskTreeCategoryChip } from '@/components/app';
import {
  Tooltip,
  filledAccentPillControlClassName,
  filledMediumPillControlClassName,
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
import { RecurrenceActionsMenu } from './recurrence-actions-menu';
import { formatRecurrenceFrequency } from './recurrence-format';

function RecurrenceCounts({
  done,
  notDone,
}: {
  done: number;
  notDone: number;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <p className="flex w-44 shrink-0 items-center gap-3 text-xs whitespace-nowrap text-[#aebac8] touch:w-full">
      <span>
        {done === 1
          ? labels.doneCountOne
          : labels.doneCount.replace('{count}', String(done))}
      </span>
      <span>
        {notDone === 1
          ? labels.notDoneCountOne
          : labels.notDoneCount.replace('{count}', String(notDone))}
      </span>
    </p>
  );
}

function RecurrenceRate({ name, rate }: { name: string; rate: number | null }) {
  const labels = useAppContext().dictionary.recurring;
  const percent = rate === null ? null : Math.round(rate);

  return (
    <div className="flex w-52 shrink-0 items-center gap-3 touch:w-full">
      <span
        className={`w-20 shrink-0 text-right whitespace-nowrap touch:w-auto touch:text-left ${
          percent === null
            ? 'text-xs text-[#aebac8]'
            : 'text-base font-semibold text-[#f7d7ad]'
        }`}
      >
        {percent === null ? labels.noData : `${percent}%`}
      </span>
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
      className={`card-surface-soft relative flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5 pr-12 pl-4 ${
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
      <RecurrenceCounts done={done} notDone={notDone} />
      <RecurrenceRate name={recurrence.text} rate={rate} />
      <span className="absolute top-1/2 right-2 -translate-y-1/2 touch:top-2.5 touch:translate-y-0">
        <RecurrenceActionsMenu
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
    <ul className="flex flex-col gap-2">
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
