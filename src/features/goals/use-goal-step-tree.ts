'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db';
import {
  buildVisibleGoalStepRows,
  type VisibleGoalStepRow,
} from './goal-step-tree';

export function useGoalStepTree(
  scope: AppScope | null,
  goalId: string | null,
): VisibleGoalStepRow[] {
  const goalSteps = useLiveQuery(
    async () => {
      if (!scope || !goalId) {
        return [];
      }

      return db.goalSteps
        .where('[scopeId+goalId]')
        .equals([scope.id, goalId])
        .filter((goalStep) => goalStep.deletedAt === null)
        .toArray();
    },
    [scope?.id, goalId],
    [],
  );

  return useMemo(() => buildVisibleGoalStepRows(goalSteps ?? []), [goalSteps]);
}
