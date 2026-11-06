'use client';

import { Pause, Pencil, Play, Trash2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmationDialog, IconButton, toast } from '@/components/ui';
import {
  pauseRecurrence,
  resumeRecurrence,
  softDeleteRecurrence,
} from '@/lib/db';
import {
  isRecurrencePaused,
  type LocalDateString,
  type Recurrence,
} from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { useAppContext } from '@/providers';

const actionClassName =
  'rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';
const dangerActionClassName =
  'rounded-full text-[#aebac8] hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-rose-200';

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

function RecurrenceActionButton({
  danger = false,
  icon: Icon,
  label,
  name,
  onClick,
}: {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  name: string;
  onClick: () => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <IconButton
      aria-label={dictionary.recurring.actionLabel
        .replace('{action}', label)
        .replace('{name}', name)}
      size="compact"
      tooltip={label}
      className={danger ? dangerActionClassName : actionClassName}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-4" />
    </IconButton>
  );
}

export function RecurrenceActions({
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
      <RecurrenceActionButton
        icon={Pencil}
        label={labels.actionEdit}
        name={name}
        onClick={() => onEdit(recurrence)}
      />
      <RecurrenceActionButton
        icon={isPaused ? Play : Pause}
        label={isPaused ? labels.actionResume : labels.actionPause}
        name={name}
        onClick={togglePause}
      />
      <RecurrenceActionButton
        danger
        icon={Trash2}
        label={labels.actionDelete}
        name={name}
        onClick={() => setIsDeleteOpen(true)}
      />
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
