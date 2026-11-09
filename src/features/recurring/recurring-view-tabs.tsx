'use client';

import { ChartNoAxesColumn, ListChecks, ListTodo } from 'lucide-react';
import {
  compactActivePillTabClassName,
  compactPillTabClassName,
  compactPillTabListClassName,
} from '@/components/ui';
import { useAppContext } from '@/providers';

export type RecurringView = 'execute' | 'activities' | 'performance';

export function RecurringViewTabs({
  view,
  onChange,
}: {
  view: RecurringView;
  onChange: (view: RecurringView) => void;
}) {
  const labels = useAppContext().dictionary.recurring;
  const options = [
    { icon: ListChecks, label: labels.viewExecute, value: 'execute' },
    { icon: ListTodo, label: labels.viewActivities, value: 'activities' },
    {
      icon: ChartNoAxesColumn,
      label: labels.viewPerformance,
      value: 'performance',
    },
  ] as const;

  return (
    <div
      role="group"
      aria-label={labels.viewsLabel}
      className={`${compactPillTabListClassName} w-fit shrink-0 touch:w-full`}
    >
      {options.map(({ icon: Icon, label, value }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          className={`${
            view === value
              ? compactActivePillTabClassName
              : compactPillTabClassName
          } touch:flex-1`}
          onClick={() => onChange(value)}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
