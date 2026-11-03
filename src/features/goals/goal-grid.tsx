'use client';

import { type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import type { CategoryTag, Goal, GoalGroup } from '@/lib/domain';
import {
  getGoalStepSummary,
  type GoalStepSummary,
} from './use-goal-step-summaries';
import { DragPayload, DragTarget } from './goal-drag-target';
import { GoalCard } from './goal-card';

export function GoalGrid({
  children,
  activeDragPayload,
  archived,
  dragTarget,
  goals,
  groups,
  goalCategoryMap,
  layout = 'default',
  summaries,
  onBeginPointerDrag,
  onComplete,
  onMoveGoal,
  onOpenGoal,
  onRestore,
}: {
  activeDragPayload: DragPayload | null;
  archived: boolean;
  dragTarget: DragTarget | null;
  goals: Goal[];
  groups: GoalGroup[];
  goalCategoryMap: Map<string, CategoryTag>;
  layout?: 'default' | 'overview';
  summaries: Map<string, GoalStepSummary>;
  onComplete?: (goalId: string) => Promise<void> | void;
  onBeginPointerDrag?: (
    payload: DragPayload,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onMoveGoal?: (goalId: string, groupId: string | null) => Promise<void> | void;
  onOpenGoal: (goalId: string) => void;
  onRestore?: (goalId: string) => Promise<void> | void;
  children?: ReactNode;
}) {
  if (goals.length === 0 && !children) {
    return null;
  }

  return (
    <div
      className={`grid gap-3 md:grid-cols-2 ${
        layout === 'overview'
          ? 'lg:grid-cols-3 xl:grid-cols-4'
          : 'xl:grid-cols-3'
      }`}
    >
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          activeDragPayload={activeDragPayload}
          archived={archived}
          dragTarget={dragTarget}
          goal={goal}
          goalCategory={goalCategoryMap.get(goal.categoryTagId ?? '')}
          groups={groups}
          summary={getGoalStepSummary(summaries, goal.id)}
          onBeginPointerDrag={onBeginPointerDrag}
          onComplete={onComplete}
          onMoveGoal={onMoveGoal}
          onOpen={onOpenGoal}
          onRestore={onRestore}
        />
      ))}
      {children}
    </div>
  );
}
