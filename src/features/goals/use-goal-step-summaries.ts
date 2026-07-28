'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db';

export interface GoalStepSummary {
  completedCount: number;
  itemCount: number;
  categoryTagIds: string[];
  categorySummaries: Map<
    string,
    {
      completedCount: number;
      itemCount: number;
    }
  >;
}

const emptySummary: GoalStepSummary = {
  completedCount: 0,
  itemCount: 0,
  categoryTagIds: [],
  categorySummaries: new Map(),
};

export function useGoalStepSummaries(
  scope: AppScope | null,
): Map<string, GoalStepSummary> {
  const goalSteps = useLiveQuery(
    async () => {
      if (!scope) {
        return [];
      }

      return db.goalSteps
        .where('scopeId')
        .equals(scope.id)
        .filter((step) => step.deletedAt === null)
        .toArray();
    },
    [scope?.id],
    [],
  );

  return useMemo(() => {
    const summaries = new Map<string, GoalStepSummary>();

    for (const step of goalSteps ?? []) {
      if (step.ignored) {
        continue;
      }

      const current: GoalStepSummary = summaries.get(step.goalId) ?? {
        completedCount: 0,
        itemCount: 0,
        categoryTagIds: [] as string[],
        categorySummaries: new Map(),
      };

      current.itemCount += 1;

      if (step.completed) {
        current.completedCount += 1;
      }

      if (step.categoryTagId) {
        const categoryTagId = step.categoryTagId;
        const categorySummary = current.categorySummaries.get(
          categoryTagId,
        ) ?? {
          completedCount: 0,
          itemCount: 0,
        };

        categorySummary.itemCount += 1;

        if (step.completed) {
          categorySummary.completedCount += 1;
        }

        current.categorySummaries.set(categoryTagId, categorySummary);

        if (!current.categoryTagIds.includes(categoryTagId)) {
          current.categoryTagIds.push(categoryTagId);
        }
      }

      summaries.set(step.goalId, current);
    }

    return summaries;
  }, [goalSteps]);
}

export function getGoalStepSummary(
  summaries: Map<string, GoalStepSummary>,
  goalId: string,
): GoalStepSummary {
  return summaries.get(goalId) ?? emptySummary;
}
