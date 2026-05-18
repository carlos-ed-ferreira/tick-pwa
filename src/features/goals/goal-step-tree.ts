import type { GoalStep } from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';

export interface VisibleGoalStepRow {
  goalStep: GoalStep;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
}

function parentKey(parentId: string | null): string {
  return parentId ?? 'root';
}

export function buildVisibleGoalStepRows(
  goalSteps: GoalStep[],
): VisibleGoalStepRow[] {
  const childrenByParent = new Map<string, GoalStep[]>();

  for (const goalStep of goalSteps) {
    if (goalStep.deletedAt) {
      continue;
    }

    const key = parentKey(goalStep.parentId);
    const children = childrenByParent.get(key) ?? [];
    children.push(goalStep);
    childrenByParent.set(key, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((firstGoalStep, secondGoalStep) =>
      compareSortRanks(firstGoalStep.sortRank, secondGoalStep.sortRank),
    );
  }

  const rows: VisibleGoalStepRow[] = [];
  const visitedGoalStepIds = new Set<string>();

  function appendRows(parentId: string | null, depth: number) {
    const siblings = childrenByParent.get(parentKey(parentId)) ?? [];

    for (const [index, goalStep] of siblings.entries()) {
      if (visitedGoalStepIds.has(goalStep.id)) {
        continue;
      }

      visitedGoalStepIds.add(goalStep.id);
      const children = childrenByParent.get(parentKey(goalStep.id)) ?? [];
      rows.push({
        goalStep,
        depth,
        childCount: children.length,
        hasChildren: children.length > 0,
        isFirstSibling: index === 0,
        isLastSibling: index === siblings.length - 1,
      });

      if (!goalStep.collapsed) {
        appendRows(goalStep.id, depth + 1);
      }
    }
  }

  appendRows(null, 0);

  return rows;
}
