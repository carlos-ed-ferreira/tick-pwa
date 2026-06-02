import type { GoalStep } from '@/lib/domain';
import { buildVisibleTreeRows } from '@/lib/domain';

export interface VisibleGoalStepRow {
  goalStep: GoalStep;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
}

export function buildVisibleGoalStepRows(
  goalSteps: GoalStep[],
): VisibleGoalStepRow[] {
  return buildVisibleTreeRows(goalSteps).map(({ item, ...row }) => ({
    ...row,
    goalStep: item,
  }));
}
