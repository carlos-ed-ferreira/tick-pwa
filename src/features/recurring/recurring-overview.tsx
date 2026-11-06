'use client';

import { Pause, Pencil, Play, Plus, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TaskTreeCategoryChip } from '@/components/app';
import {
  ConfirmationDialog,
  IconButton,
  Tooltip,
  filledCompactPillControlClassName,
  filledControlAccentClassName,
  toast,
} from '@/components/ui';
import {
  pauseRecurrence,
  resumeRecurrence,
  softDeleteRecurrence,
} from '@/lib/db';
import {
  computeRecurrenceStats,
  isRecurrencePaused,
  type LocalDateString,
  type Recurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { CategoryManagerAction, useCategoryTags } from '@/features/categories';
import { useAppContext } from '@/providers';
import { formatRecurrenceFrequency } from './recurrence-format';

const rowActionClassName =
  'rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';
const dangerRowActionClassName =
  'rounded-full text-[#aebac8] hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-rose-200';
const overviewMessageClassName = 'py-6 text-center text-sm text-[#aebac8]';

function RecurrenceStatsLine({
  responses,
}: {
  responses: RecurrenceResponse[];
}) {
  const labels = useAppContext().dictionary.recurring;
  const { done, notDone, rate } = computeRecurrenceStats(responses);

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#aebac8]">
      <span>{labels.doneCount.replace('{count}', String(done))}</span>
      <span>{labels.notDoneCount.replace('{count}', String(notDone))}</span>
      <span className="font-semibold text-[#f7d7ad]">
        {rate === null
          ? labels.noData
          : labels.completionRate.replace('{rate}', String(Math.round(rate)))}
      </span>
    </p>
  );
}

function getDeleteDescription(
  labels: Dictionary['recurring'],
  count: number,
): string {
  if (count === 0) {
    return labels.deleteDescriptionNone;
  }

  return count === 1
    ? labels.deleteDescriptionOne
    : labels.deleteDescriptionMany.replace('{count}', String(count));
}

function RecurrenceCardActions({
  answerCount,
  recurrence,
  today,
  onEdit,
}: {
  answerCount: number;
  recurrence: Recurrence;
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const labels = dictionary.recurring;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const isPaused = isRecurrencePaused(recurrence.schedule);
  const name = recurrence.text;
  const pauseLabel = isPaused ? labels.resumeActivity : labels.pauseActivity;

  function run(action: () => Promise<void>) {
    void action().catch((error: unknown) => {
      console.error('Failed to change a recurrence.', error);
      toast.error(labels.saveFailed);
    });
  }

  function togglePause() {
    if (scope) {
      const command = isPaused ? resumeRecurrence : pauseRecurrence;

      run(() => command({ recurrenceId: recurrence.id, scope, today }));
    }
  }

  function confirmDelete() {
    setIsDeleteOpen(false);

    if (scope) {
      run(() => softDeleteRecurrence({ recurrenceId: recurrence.id, scope }));
    }
  }

  return (
    <span className="flex shrink-0 items-center">
      <IconButton
        aria-label={labels.editActivity.replace('{name}', name)}
        size="compact"
        className={rowActionClassName}
        onClick={() => onEdit(recurrence)}
      >
        <Pencil aria-hidden="true" className="size-4" />
      </IconButton>
      <IconButton
        aria-label={pauseLabel.replace('{name}', name)}
        size="compact"
        className={rowActionClassName}
        onClick={togglePause}
      >
        {isPaused ? (
          <Play aria-hidden="true" className="size-4" />
        ) : (
          <Pause aria-hidden="true" className="size-4" />
        )}
      </IconButton>
      <IconButton
        aria-label={labels.deleteActivity.replace('{name}', name)}
        size="compact"
        className={dangerRowActionClassName}
        onClick={() => setIsDeleteOpen(true)}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </IconButton>
      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={getDeleteDescription(labels, answerCount)}
        open={isDeleteOpen}
        title={labels.deleteTitle}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </span>
  );
}

function RecurrenceCard({
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
  const isPaused = isRecurrencePaused(recurrence.schedule);

  return (
    <li
      className={`card-surface-soft flex flex-col gap-1.5 p-3 ${
        isPaused ? 'opacity-70' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {recurrence.priority ? (
          <Star
            aria-label={dictionary.recurring.priority}
            className="size-3.5 shrink-0 fill-[#f0c38e] text-[#f0c38e]"
            role="img"
          />
        ) : null}
        <Tooltip
          className="min-w-0 flex-1"
          content={recurrence.text}
          whenTruncated
        >
          <span
            className={`min-w-0 flex-1 truncate text-sm text-[#fff9f2] ${
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
        <RecurrenceCardActions
          answerCount={responses.length}
          recurrence={recurrence}
          today={today}
          onEdit={onEdit}
        />
      </div>
      <p className="text-xs text-[#cbd5e0]">
        {formatRecurrenceFrequency(recurrence, dictionary)}
      </p>
      <RecurrenceStatsLine responses={responses} />
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

export function RecurringOverview({
  recurrences,
  responsesByRecurrence,
  today,
  onCreate,
  onEdit,
}: {
  recurrences: Recurrence[] | undefined;
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
  onCreate: () => void;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const labels = dictionary.recurring;
  const categoryTags = useCategoryTags(scope, 'recurrence');
  const categoryTagMap = useMemo(
    () => new Map(categoryTags.map((tag) => [tag.id, tag])),
    [categoryTags],
  );
  const ordered = useMemo(
    () => (recurrences ? [...recurrences].sort(compareOverview) : undefined),
    [recurrences],
  );

  return (
    <section
      aria-label={labels.overviewTitle}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#fff9f2]">
          {labels.overviewTitle}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryManagerAction
            surface="recurrence"
            title={labels.categoriesTitle}
          />
          <button
            type="button"
            className={`${filledCompactPillControlClassName} ${filledControlAccentClassName}`}
            onClick={onCreate}
          >
            <Plus aria-hidden="true" className="size-4" />
            {labels.newActivity}
          </button>
        </div>
      </div>
      {ordered === undefined ? (
        <p aria-busy="true" className={overviewMessageClassName}>
          {labels.loading}
        </p>
      ) : ordered.length === 0 ? (
        <p className={overviewMessageClassName}>{labels.overviewEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((recurrence) => (
            <RecurrenceCard
              key={recurrence.id}
              category={categoryTagMap.get(recurrence.categoryTagId ?? '')}
              recurrence={recurrence}
              responses={responsesByRecurrence.get(recurrence.id) ?? []}
              today={today}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
