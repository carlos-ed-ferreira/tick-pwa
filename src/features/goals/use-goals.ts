'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, Goal, GoalCategory } from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';
import { db } from '@/lib/db';

export function useGoals(
  scope: AppScope | null,
  category: GoalCategory,
): Goal[] {
  return (
    useLiveQuery(
      async () => {
        if (!scope) {
          return [];
        }

        const goals = await db.goals
          .where('[scopeId+category]')
          .equals([scope.id, category])
          .filter((goal) => goal.deletedAt === null && goal.archivedAt === null)
          .toArray();

        return goals.sort((firstGoal, secondGoal) =>
          compareSortRanks(firstGoal.sortRank, secondGoal.sortRank),
        );
      },
      [scope?.id, category],
      [],
    ) ?? []
  );
}
