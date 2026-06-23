'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, GoalGroup } from '@/lib/domain';
import { sortByRank } from '@/lib/domain';
import { db } from '@/lib/db';

export function useGoalGroups(scope: AppScope | null): GoalGroup[] {
  return (
    useLiveQuery(
      async () => {
        if (!scope) {
          return [];
        }

        const groups = await db.goalGroups
          .where('scopeId')
          .equals(scope.id)
          .filter((group) => group.deletedAt === null)
          .toArray();

        return sortByRank(groups);
      },
      [scope?.id],
      [],
    ) ?? []
  );
}
