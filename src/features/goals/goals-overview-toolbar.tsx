'use client';

import { Archive, Target } from 'lucide-react';
import {
  activePillTabClassName,
  pillTabClassName,
  pillTabListClassName,
} from '@/components/app/header-control';
import { CategoryManagerAction } from '@/features/categories';
import { useAppContext } from '@/providers';

export type GoalsOverviewView = 'active' | 'archived';

export function GoalsOverviewToolbar({
  view,
  onViewChange,
}: {
  view: GoalsOverviewView;
  onViewChange: (view: GoalsOverviewView) => void;
}) {
  const { dictionary } = useAppContext();
  const options = [
    { icon: Target, label: dictionary.goals.activeGoals, value: 'active' },
    { icon: Archive, label: dictionary.goals.archivedGoals, value: 'archived' },
  ] as const;

  return (
    <div
      aria-label={dictionary.navigation.goals}
      className="flex flex-wrap items-center gap-2 px-1 sm:px-0"
      role="toolbar"
    >
      <div className={pillTabListClassName}>
        {options.map(({ icon: Icon, label, value }) => (
          <button
            key={value}
            aria-pressed={view === value}
            className={
              view === value ? activePillTabClassName : pillTabClassName
            }
            type="button"
            onClick={() => onViewChange(value)}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <CategoryManagerAction
        surface="goal"
        title={dictionary.goals.editCategories}
      />
    </div>
  );
}
