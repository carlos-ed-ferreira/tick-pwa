'use client';

import { Pause, Star } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { TaskTreeCategoryChip } from '@/components/app';
import { Tooltip } from '@/components/ui';
import { isRecurrencePaused, type Recurrence } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { formatRecurrenceFrequency } from './recurrence-format';

export interface RecurrenceCategory {
  colorHex: string;
  name: string;
}

const priorityStyle: CSSProperties = {
  boxShadow:
    'inset 4px 0 0 0 rgba(240, 195, 142, 1), inset 0 0 18px rgba(240, 195, 142, 0.12)',
};

export function RecurringRowSurface({
  children,
  className = '',
  isPriority,
}: {
  children: ReactNode;
  className?: string;
  isPriority: boolean;
}) {
  return (
    <li
      className={`relative flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-white/[0.035] transition hover:bg-white/[0.065] ${className}`}
      style={isPriority ? priorityStyle : undefined}
    >
      {children}
    </li>
  );
}

export function useRecurrenceFrequency(recurrence: Recurrence): string {
  return formatRecurrenceFrequency(recurrence, useAppContext().dictionary);
}

export function PausedBadge() {
  const labels = useAppContext().dictionary.recurring;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[0.6875rem] font-medium text-[#e5ebf3]">
      <Pause aria-hidden="true" className="size-3" />
      {labels.paused}
    </span>
  );
}

export function RecurrenceIdentity({
  category,
  recurrence,
}: {
  category?: RecurrenceCategory;
  recurrence: Recurrence;
}) {
  const labels = useAppContext().dictionary.recurring;
  const frequency = useRecurrenceFrequency(recurrence);
  const isPaused = isRecurrencePaused(recurrence.schedule);

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        {recurrence.priority ? (
          <Star
            aria-label={labels.priority}
            className="size-3.5 shrink-0 fill-[#f0c38e] text-[#f0c38e]"
            role="img"
          />
        ) : null}
        <Tooltip className="min-w-0" content={recurrence.text} whenTruncated>
          <span
            className={`block min-w-0 truncate text-sm ${
              isPaused ? 'text-[#cbd5e0]' : 'text-[#fff9f2]'
            } ${recurrence.bold ? 'font-bold' : 'font-medium'}`}
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
      </span>
      <span className="flex min-w-0 items-center gap-2 text-xs text-[#aebac8]">
        {isPaused ? <PausedBadge /> : null}
        <span className="truncate">{frequency}</span>
      </span>
    </span>
  );
}
