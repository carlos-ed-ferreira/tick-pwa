'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, Goal } from '@/lib/domain';
import { sortByRank } from '@/lib/domain';
import { db } from '@/lib/db';

export function useGoals(
  scope: AppScope | null,
  {
    archived = false,
    groupId,
  }: {
    archived?: boolean;
    groupId?: string | null;
  } = {},
): Goal[] {
  return (
    useLiveQuery(
      async () => {
        if (!scope) {
          return [];
        }

        const goals = await db.goals
          .where('scopeId')
          .equals(scope.id)
          .filter(
            (goal) =>
              goal.deletedAt === null &&
              (archived
                ? goal.completedAt !== null
                : goal.completedAt === null) &&
              (groupId === undefined || goal.groupId === groupId),
          )
          .toArray();

        return sortByRank(goals);
      },
      [archived, groupId, scope?.id],
      [],
    ) ?? []
  );
}
