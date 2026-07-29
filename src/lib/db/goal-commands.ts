import type {
  AppScope,
  Goal,
  GoalCategory,
  GoalGroup,
  GoalStep,
} from '@/lib/domain';
import {
  createRankAfter,
  createId,
  createReorderedRank,
  createSortRankBetween,
  getNextTaskCompletionValues,
  sortByRank,
} from '@/lib/domain';
import { db } from './database';
import { softDeleteCategoryTag } from './category-commands';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { persistAccountEntityChange } from './account-persistence';

function normalizeGoalTitle(title: string): string {
  return title.normalize('NFC').trim().toLocaleUpperCase();
}

// Own-name categories exist only for a single group/goal. When that entity
// stops referencing it, the tag becomes orphaned and must be removed.
async function resolveOrphanOwnCategoryTagId(
  scope: AppScope,
  previousCategoryTagId: string | null,
): Promise<string | null> {
  if (!previousCategoryTagId) {
    return null;
  }

  const previous = await db.categoryTags.get(previousCategoryTagId);

  if (
    previous &&
    previous.scopeId === scope.id &&
    !previous.deletedAt &&
    previous.useOwnName
  ) {
    return previous.id;
  }

  return null;
}

function sortGoalSteps(goalSteps: GoalStep[]): GoalStep[] {
  return sortByRank(goalSteps);
}

async function getActiveGoalSteps(
  scope: AppScope,
  goalId: string,
): Promise<GoalStep[]> {
  return db.goalSteps
    .where('[scopeId+goalId]')
    .equals([scope.id, goalId])
    .filter((goalStep) => goalStep.deletedAt === null)
    .toArray();
}

function createGoalInsertRank({
  siblings,
  afterGoalId,
}: {
  siblings: Goal[];
  afterGoalId?: string | null;
}): string {
  return createRankAfter({ items: siblings, afterItemId: afterGoalId });
}

function createGoalStepInsertRank({
  siblings,
  afterGoalStepId,
}: {
  siblings: GoalStep[];
  afterGoalStepId?: string | null;
}): string {
  return createRankAfter({ items: siblings, afterItemId: afterGoalStepId });
}

function hasMeaningfulGoalStepText(text: string): boolean {
  return text.trim().length > 0;
}

async function persistGoalUpdate(
  scope: AppScope,
  goal: Goal,
  changedFields: string[],
): Promise<void> {
  await db.goals.put(goal);
  await persistAccountEntityChange({
    scope,
    entityType: 'goal',
    entityId: goal.id,
    operation: goal.deletedAt ? 'delete' : 'upsert',
    payload: goal as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: goal.remoteRevision,
  });
}

async function persistGoalStepUpdate(
  scope: AppScope,
  goalStep: GoalStep,
  changedFields: string[],
): Promise<void> {
  await db.goalSteps.put(goalStep);
  await persistAccountEntityChange({
    scope,
    entityType: 'goalStep',
    entityId: goalStep.id,
    operation: goalStep.deletedAt ? 'delete' : 'upsert',
    payload: goalStep as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: goalStep.remoteRevision,
  });
}

function touchGoal(scope: AppScope, goal: Goal): Goal {
  const now = createTimestamp();

  return {
    ...goal,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

function touchGoalStep(scope: AppScope, goalStep: GoalStep): GoalStep {
  const now = createTimestamp();

  return {
    ...goalStep,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

function touchGoalGroup(scope: AppScope, goalGroup: GoalGroup): GoalGroup {
  const now = createTimestamp();

  return {
    ...goalGroup,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

async function persistGoalGroupUpdate(
  scope: AppScope,
  goalGroup: GoalGroup,
  changedFields: string[],
): Promise<void> {
  await db.goalGroups.put(goalGroup);
  await persistAccountEntityChange({
    scope,
    entityType: 'goalGroup',
    entityId: goalGroup.id,
    operation: goalGroup.deletedAt ? 'delete' : 'upsert',
    payload: goalGroup as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: goalGroup.remoteRevision,
  });
}

export async function createGoalGroup({
  scope,
  title = '',
  afterGoalGroupId = null,
}: {
  scope: AppScope;
  title?: string;
  afterGoalGroupId?: string | null;
}): Promise<GoalGroup> {
  return db.transaction('rw', db.goalGroups, async () => {
    const groups = await db.goalGroups
      .where('scopeId')
      .equals(scope.id)
      .filter((group) => group.deletedAt === null)
      .toArray();
    const now = createTimestamp();
    const goalGroup: GoalGroup = {
      id: createId(),
      scopeId: scope.id,
      title: normalizeGoalTitle(title),
      categoryTagId: null,
      sortRank: createRankAfter({
        items: sortByRank(groups),
        afterItemId: afterGoalGroupId,
      }),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.goalGroups.add(goalGroup);
    await persistAccountEntityChange({
      scope,
      entityType: 'goalGroup',
      entityId: goalGroup.id,
      operation: 'upsert',
      payload: goalGroup as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    return goalGroup;
  });
}

export async function assignGoalGroupCategory({
  scope,
  goalGroupId,
  categoryTagId,
}: {
  scope: AppScope;
  goalGroupId: string;
  categoryTagId: string | null;
}): Promise<void> {
  let orphanOwnCategoryTagId: string | null = null;

  await db.transaction('rw', db.goalGroups, db.categoryTags, async () => {
    const group = await db.goalGroups.get(goalGroupId);
    const categoryTag = categoryTagId
      ? await db.categoryTags.get(categoryTagId)
      : null;

    if (!group || group.scopeId !== scope.id || group.deletedAt) {
      return;
    }

    const safeCategoryTagId =
      categoryTag &&
      categoryTag.scopeId === scope.id &&
      !categoryTag.deletedAt &&
      categoryTag.surface === 'goal_group'
        ? categoryTag.id
        : null;

    if (group.categoryTagId === safeCategoryTagId) {
      return;
    }

    orphanOwnCategoryTagId = await resolveOrphanOwnCategoryTagId(
      scope,
      group.categoryTagId,
    );

    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, categoryTagId: safeCategoryTagId }),
      ['categoryTagId'],
    );
  });

  if (orphanOwnCategoryTagId) {
    await softDeleteCategoryTag({
      scope,
      categoryTagId: orphanOwnCategoryTagId,
    });
  }
}

export async function updateGoalGroupTitle({
  scope,
  goalGroupId,
  title,
}: {
  scope: AppScope;
  goalGroupId: string;
  title: string;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, async () => {
    const group = await getScopedGoalGroup(scope, goalGroupId);
    const normalizedTitle = normalizeGoalTitle(title);

    if (!group || !normalizedTitle || group.title === normalizedTitle) {
      return;
    }

    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, title: normalizedTitle }),
      ['title'],
    );
  });
}

export async function reorderGoalGroup({
  scope,
  goalGroupId,
  direction,
}: {
  scope: AppScope;
  goalGroupId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, async () => {
    const group = await getScopedGoalGroup(scope, goalGroupId);

    if (!group) {
      return;
    }

    const groups = await db.goalGroups
      .where('scopeId')
      .equals(scope.id)
      .filter((candidate) => candidate.deletedAt === null)
      .toArray();
    const sortRank = createReorderedRank({
      items: groups,
      itemId: group.id,
      direction,
    });

    if (!sortRank || sortRank === group.sortRank) {
      return;
    }

    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, sortRank }),
      ['sortRank'],
    );
  });
}

export async function moveGoalGroupAfter({
  scope,
  goalGroupId,
  targetGoalGroupId,
}: {
  scope: AppScope;
  goalGroupId: string;
  targetGoalGroupId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, async () => {
    if (goalGroupId === targetGoalGroupId) {
      return;
    }

    const group = await getScopedGoalGroup(scope, goalGroupId);
    const targetGroup = await getScopedGoalGroup(scope, targetGoalGroupId);

    if (!group || !targetGroup) {
      return;
    }

    const groups = await db.goalGroups
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (candidate) =>
          candidate.deletedAt === null && candidate.id !== group.id,
      )
      .toArray();
    const sortRank = createRankAfter({
      afterItemId: targetGroup.id,
      items: groups,
    });

    if (sortRank === group.sortRank) {
      return;
    }

    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, sortRank }),
      ['sortRank'],
    );
  });
}

export async function moveGoalGroupBefore({
  scope,
  goalGroupId,
  targetGoalGroupId,
}: {
  scope: AppScope;
  goalGroupId: string;
  targetGoalGroupId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, async () => {
    if (goalGroupId === targetGoalGroupId) {
      return;
    }

    const group = await getScopedGoalGroup(scope, goalGroupId);
    const targetGroup = await getScopedGoalGroup(scope, targetGoalGroupId);

    if (!group || !targetGroup) {
      return;
    }

    const groups = await db.goalGroups
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (candidate) =>
          candidate.deletedAt === null && candidate.id !== group.id,
      )
      .toArray();
    const orderedGroups = sortByRank(groups);
    const targetIndex = orderedGroups.findIndex(
      (candidate) => candidate.id === targetGroup.id,
    );

    if (targetIndex < 0) {
      return;
    }

    const previousGroup = orderedGroups[targetIndex - 1] ?? null;
    const sortRank = createSortRankBetween(
      previousGroup?.sortRank ?? null,
      targetGroup.sortRank,
    );

    if (sortRank === group.sortRank) {
      return;
    }

    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, sortRank }),
      ['sortRank'],
    );
  });
}

export async function softDeleteGoalGroup({
  scope,
  goalGroupId,
}: {
  scope: AppScope;
  goalGroupId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, db.goals, async () => {
    const group = await getScopedGoalGroup(scope, goalGroupId);

    if (!group) {
      return;
    }

    const deletedAt = createTimestamp();
    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, deletedAt }),
      ['deletedAt'],
    );

    const goals = await db.goals
      .where('[scopeId+groupId]')
      .equals([scope.id, group.id])
      .filter((goal) => goal.deletedAt === null)
      .toArray();

    for (const goal of goals) {
      await persistGoalUpdate(
        scope,
        touchGoal(scope, { ...goal, groupId: null }),
        ['groupId'],
      );
    }
  });
}

export async function moveGoalToGroup({
  scope,
  goalId,
  groupId,
}: {
  scope: AppScope;
  goalId: string;
  groupId: string | null;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, db.goals, async () => {
    const goal = await getScopedGoal(scope, goalId);
    const group = groupId ? await db.goalGroups.get(groupId) : null;
    const safeGroupId =
      group && group.scopeId === scope.id && !group.deletedAt ? group.id : null;

    if (!goal || goal.groupId === safeGroupId) {
      return;
    }
    const sourceGroupId = goal.groupId;

    const targetGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (candidate) =>
          candidate.groupId === safeGroupId &&
          candidate.deletedAt === null &&
          candidate.completedAt === null,
      )
      .toArray();

    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...goal,
        groupId: safeGroupId,
        sortRank: createRankAfter({ items: targetGoals }),
      }),
      ['groupId', 'sortRank'],
    );

    await deleteGroupIfEmpty(scope, sourceGroupId);
  });
}

async function deleteGroupIfEmpty(
  scope: AppScope,
  goalGroupId: string | null,
): Promise<void> {
  if (!goalGroupId) {
    return;
  }

  const group = await getScopedGoalGroup(scope, goalGroupId);

  if (!group) {
    return;
  }

  const remainingGoals = await db.goals
    .where('[scopeId+groupId]')
    .equals([scope.id, goalGroupId])
    .filter((goal) => goal.deletedAt === null)
    .limit(1)
    .toArray();

  if (remainingGoals.length > 0) {
    return;
  }

  await persistGoalGroupUpdate(
    scope,
    touchGoalGroup(scope, { ...group, deletedAt: createTimestamp() }),
    ['deletedAt'],
  );
}

export async function groupGoalsTogether({
  scope,
  sourceGoalId,
  targetGoalId,
  title = '',
}: {
  scope: AppScope;
  sourceGoalId: string;
  targetGoalId: string;
  title?: string;
}): Promise<GoalGroup | null> {
  return db.transaction('rw', db.goalGroups, db.goals, async () => {
    if (sourceGoalId === targetGoalId) {
      return null;
    }

    const sourceGoal = await getScopedGoal(scope, sourceGoalId);
    const targetGoal = await getScopedGoal(scope, targetGoalId);

    if (
      !sourceGoal ||
      !targetGoal ||
      sourceGoal.completedAt ||
      targetGoal.completedAt
    ) {
      return null;
    }

    if (targetGoal.groupId) {
      await moveGoalToGroup({
        scope,
        goalId: sourceGoal.id,
        groupId: targetGoal.groupId,
      });

      return getScopedGoalGroup(scope, targetGoal.groupId);
    }

    const group = await createGoalGroup({
      scope,
      title: title || targetGoal.title || sourceGoal.title,
    });
    const firstRank = createSortRankBetween(null, null);
    const secondRank = createSortRankBetween(firstRank, null);

    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...targetGoal,
        groupId: group.id,
        sortRank: firstRank,
      }),
      ['groupId', 'sortRank'],
    );
    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...sourceGoal,
        groupId: group.id,
        sortRank: secondRank,
      }),
      ['groupId', 'sortRank'],
    );
    await deleteGroupIfEmpty(scope, sourceGoal.groupId);

    return group;
  });
}

export async function reorderGoal({
  scope,
  goalId,
  direction,
}: {
  scope: AppScope;
  goalId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await getScopedGoal(scope, goalId);

    if (!goal) {
      return;
    }

    const siblings = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (candidate) =>
          candidate.groupId === goal.groupId &&
          candidate.deletedAt === null &&
          candidate.completedAt === null,
      )
      .toArray();
    const sortRank = createReorderedRank({
      items: siblings,
      itemId: goal.id,
      direction,
    });

    if (!sortRank || sortRank === goal.sortRank) {
      return;
    }

    await persistGoalUpdate(scope, touchGoal(scope, { ...goal, sortRank }), [
      'sortRank',
    ]);
  });
}

export async function moveGoalAfter({
  scope,
  goalId,
  targetGoalId,
}: {
  scope: AppScope;
  goalId: string;
  targetGoalId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, db.goals, async () => {
    if (goalId === targetGoalId) {
      return;
    }

    const goal = await getScopedGoal(scope, goalId);
    const targetGoal = await getScopedGoal(scope, targetGoalId);

    if (!goal || !targetGoal) {
      return;
    }

    const sourceGroupId = goal.groupId;
    const targetGroupId = targetGoal.groupId;
    const targetGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (candidate) =>
          candidate.groupId === targetGroupId &&
          candidate.deletedAt === null &&
          candidate.completedAt === null &&
          candidate.id !== goal.id,
      )
      .toArray();
    const sortRank = createRankAfter({
      afterItemId: targetGoal.id,
      items: targetGoals,
    });

    if (sortRank === goal.sortRank && goal.groupId === targetGroupId) {
      return;
    }

    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...goal,
        groupId: targetGroupId,
        sortRank,
      }),
      ['groupId', 'sortRank'],
    );

    await deleteGroupIfEmpty(scope, sourceGroupId);
  });
}

export async function moveGoalBefore({
  scope,
  goalId,
  targetGoalId,
}: {
  scope: AppScope;
  goalId: string;
  targetGoalId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalGroups, db.goals, async () => {
    if (goalId === targetGoalId) {
      return;
    }

    const goal = await getScopedGoal(scope, goalId);
    const targetGoal = await getScopedGoal(scope, targetGoalId);

    if (!goal || !targetGoal) {
      return;
    }

    const sourceGroupId = goal.groupId;
    const targetGroupId = targetGoal.groupId;
    const targetGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (candidate) =>
          candidate.groupId === targetGroupId &&
          candidate.deletedAt === null &&
          candidate.completedAt === null &&
          candidate.id !== goal.id,
      )
      .toArray();
    const orderedGoals = sortByRank(targetGoals);
    const targetIndex = orderedGoals.findIndex(
      (candidate) => candidate.id === targetGoal.id,
    );

    if (targetIndex < 0) {
      return;
    }

    const previousGoal = orderedGoals[targetIndex - 1] ?? null;
    const sortRank = createSortRankBetween(
      previousGoal?.sortRank ?? null,
      targetGoal.sortRank,
    );

    if (sortRank === goal.sortRank && goal.groupId === targetGroupId) {
      return;
    }

    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...goal,
        groupId: targetGroupId,
        sortRank,
      }),
      ['groupId', 'sortRank'],
    );

    await deleteGroupIfEmpty(scope, sourceGroupId);
  });
}

export async function completeGoal({
  scope,
  goalId,
}: {
  scope: AppScope;
  goalId: string;
}): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await getScopedGoal(scope, goalId);

    if (!goal || goal.completedAt) {
      return;
    }

    const completedAt = createTimestamp();
    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...goal,
        completedAt,
        archivedAt: completedAt,
        status: 'completed',
      }),
      ['completedAt'],
    );
  });
}

export async function reopenGoal({
  scope,
  goalId,
}: {
  scope: AppScope;
  goalId: string;
}): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await getScopedGoal(scope, goalId);

    if (!goal || !goal.completedAt) {
      return;
    }

    await persistGoalUpdate(
      scope,
      touchGoal(scope, {
        ...goal,
        completedAt: null,
        archivedAt: null,
        status: 'active',
      }),
      ['completedAt'],
    );
  });
}

async function getScopedGoal(
  scope: AppScope,
  goalId: string,
): Promise<Goal | null> {
  const goal = await db.goals.get(goalId);

  if (!goal || goal.scopeId !== scope.id || goal.deletedAt) {
    return null;
  }

  return goal;
}

async function getScopedGoalGroup(
  scope: AppScope,
  goalGroupId: string,
): Promise<GoalGroup | null> {
  const group = await db.goalGroups.get(goalGroupId);

  if (!group || group.scopeId !== scope.id || group.deletedAt) {
    return null;
  }

  return group;
}

async function getScopedGoalStep(
  scope: AppScope,
  goalStepId: string,
): Promise<GoalStep | null> {
  const goalStep = await db.goalSteps.get(goalStepId);

  if (!goalStep || goalStep.scopeId !== scope.id || goalStep.deletedAt) {
    return null;
  }

  return goalStep;
}

export async function createGoal({
  scope,
  category: _category = 'now',
  groupId = null,
  afterGoalId = null,
  title = '',
}: {
  scope: AppScope;
  category?: GoalCategory;
  groupId?: string | null;
  afterGoalId?: string | null;
  title?: string;
}): Promise<Goal> {
  void _category;

  return db.transaction('rw', db.goalGroups, db.goals, async () => {
    const group = groupId ? await db.goalGroups.get(groupId) : null;
    const safeGroupId =
      group && group.scopeId === scope.id && !group.deletedAt ? group.id : null;
    const activeGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter(
        (goal) =>
          goal.deletedAt === null &&
          goal.completedAt === null &&
          goal.groupId === safeGroupId,
      )
      .toArray();
    const now = createTimestamp();
    const normalizedTitle = normalizeGoalTitle(title);
    const goal: Goal = {
      id: createId(),
      scopeId: scope.id,
      groupId: safeGroupId,
      category: 'now',
      title: normalizedTitle,
      description: '',
      status: 'active',
      progressMode: 'steps',
      progressValue: 0,
      dueDate: null,
      categoryTagId: null,
      sortRank: createGoalInsertRank({ siblings: activeGoals, afterGoalId }),
      archivedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.goals.add(goal);
    await persistAccountEntityChange({
      scope,
      entityType: 'goal',
      entityId: goal.id,
      operation: 'upsert',
      payload: goal as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    return goal;
  });
}

export async function updateGoalTitle({
  scope,
  goalId,
  title,
}: {
  scope: AppScope;
  goalId: string;
  title: string;
}): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await getScopedGoal(scope, goalId);

    const normalizedTitle = normalizeGoalTitle(title);

    if (
      !goal ||
      normalizedTitle.length === 0 ||
      goal.title === normalizedTitle
    ) {
      return;
    }

    const updatedGoal = touchGoal(scope, { ...goal, title: normalizedTitle });
    await persistGoalUpdate(scope, updatedGoal, ['title']);
  });
}

export async function assignGoalCategory({
  scope,
  goalId,
  categoryTagId,
}: {
  scope: AppScope;
  goalId: string;
  categoryTagId: string | null;
}): Promise<void> {
  let orphanOwnCategoryTagId: string | null = null;

  await db.transaction('rw', db.goals, db.categoryTags, async () => {
    const goal = await getScopedGoal(scope, goalId);

    if (!goal) {
      return;
    }

    const categoryTag = categoryTagId
      ? await db.categoryTags.get(categoryTagId)
      : null;

    if (
      categoryTagId &&
      (!categoryTag ||
        categoryTag.scopeId !== scope.id ||
        categoryTag.deletedAt ||
        categoryTag.surface !== 'goal')
    ) {
      return;
    }

    const safeCategoryTagId = categoryTag?.id ?? null;

    if (goal.categoryTagId === safeCategoryTagId) {
      return;
    }

    orphanOwnCategoryTagId = await resolveOrphanOwnCategoryTagId(
      scope,
      goal.categoryTagId,
    );

    const updatedGoal = touchGoal(scope, {
      ...goal,
      categoryTagId: safeCategoryTagId,
    });
    await persistGoalUpdate(scope, updatedGoal, ['categoryTagId']);
  });

  if (orphanOwnCategoryTagId) {
    await softDeleteCategoryTag({
      scope,
      categoryTagId: orphanOwnCategoryTagId,
    });
  }
}

export async function createGoalStep({
  scope,
  goalId,
  id = createId(),
  parentId = null,
  afterGoalStepId = null,
  bold = false,
  text = '',
}: {
  scope: AppScope;
  goalId: string;
  id?: string;
  parentId?: string | null;
  afterGoalStepId?: string | null;
  bold?: boolean;
  text?: string;
}): Promise<GoalStep> {
  if (!hasMeaningfulGoalStepText(text)) {
    throw new Error('Goal steps require text before they can be saved.');
  }

  return db.transaction('rw', db.goals, db.goalSteps, async () => {
    const goal = await getScopedGoal(scope, goalId);

    if (!goal) {
      throw new Error('Cannot create a goal step for an unavailable goal.');
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goalId);
    const parentGoalStep = parentId
      ? activeGoalSteps.find((goalStep) => goalStep.id === parentId)
      : null;
    const safeParentId = parentGoalStep ? parentGoalStep.id : null;
    const siblings = activeGoalSteps.filter(
      (goalStep) => goalStep.parentId === safeParentId,
    );
    const now = createTimestamp();
    const goalStep: GoalStep = {
      id,
      scopeId: scope.id,
      goalId,
      parentId: safeParentId,
      text,
      completed: false,
      ignored: false,
      bold,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      sortRank: createGoalStepInsertRank({ siblings, afterGoalStepId }),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.goalSteps.add(goalStep);
    await persistAccountEntityChange({
      scope,
      entityType: 'goalStep',
      entityId: goalStep.id,
      operation: 'upsert',
      payload: goalStep as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    if (parentGoalStep && parentGoalStep.collapsed) {
      const updatedParent = touchGoalStep(scope, {
        ...parentGoalStep,
        collapsed: false,
      });
      await persistGoalStepUpdate(scope, updatedParent, ['collapsed']);
    }

    return goalStep;
  });
}

export async function createGoalStepChild({
  scope,
  goalId,
  parentGoalStepId,
  text,
}: {
  scope: AppScope;
  goalId: string;
  parentGoalStepId: string;
  text: string;
}): Promise<GoalStep> {
  return createGoalStep({
    scope,
    goalId,
    parentId: parentGoalStepId,
    text,
  });
}

export async function updateGoalStepText({
  scope,
  goalStepId,
  text,
}: {
  scope: AppScope;
  goalStepId: string;
  text: string;
}): Promise<void> {
  if (!hasMeaningfulGoalStepText(text)) {
    return;
  }

  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep || goalStep.text === text) {
      return;
    }

    const updatedGoalStep = touchGoalStep(scope, { ...goalStep, text });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['text']);
  });
}

export async function toggleGoalStepChecked({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goals, db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const nextState = getNextTaskCompletionValues(
      goalStep.completed,
      goalStep.ignored ?? false,
    );
    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      completed: nextState.completed,
      ignored: nextState.ignored,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, [
      'completed',
      'ignored',
    ]);
  });
}

export async function setGoalStepsCompleted({
  scope,
  goalStepIds,
  completed,
  ignored = false,
}: {
  scope: AppScope;
  goalStepIds: string[];
  completed: boolean;
  ignored?: boolean;
}): Promise<void> {
  if (goalStepIds.length === 0) {
    return;
  }

  await db.transaction('rw', db.goals, db.goalSteps, async () => {
    for (const goalStepId of goalStepIds) {
      const goalStep = await getScopedGoalStep(scope, goalStepId);

      if (
        !goalStep ||
        (goalStep.completed === completed &&
          Boolean(goalStep.ignored) === ignored)
      ) {
        continue;
      }

      const updatedGoalStep = touchGoalStep(scope, {
        ...goalStep,
        completed,
        ignored,
      });
      await persistGoalStepUpdate(scope, updatedGoalStep, [
        'completed',
        'ignored',
      ]);
    }
  });
}

export async function toggleGoalStepPriority({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      priority: !goalStep.priority,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['priority']);
  });
}

export async function toggleGoalStepBold({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      bold: !goalStep.bold,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['bold']);
  });
}

export async function toggleGoalStepCollapsed({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      collapsed: !goalStep.collapsed,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['collapsed']);
  });
}

export async function assignGoalStepCategory({
  scope,
  goalStepId,
  categoryTagId,
}: {
  scope: AppScope;
  goalStepId: string;
  categoryTagId: string | null;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, db.categoryTags, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const categoryTag = categoryTagId
      ? await db.categoryTags.get(categoryTagId)
      : null;

    if (
      categoryTagId &&
      (!categoryTag ||
        categoryTag.scopeId !== scope.id ||
        categoryTag.deletedAt ||
        categoryTag.surface !== 'goal_step')
    ) {
      return;
    }

    const safeCategoryTagId = categoryTag?.id ?? null;

    if (goalStep.categoryTagId === safeCategoryTagId) {
      return;
    }

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      categoryTagId: safeCategoryTagId,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['categoryTagId']);
  });
}

export async function softDeleteGoal({
  scope,
  goalId,
}: {
  scope: AppScope;
  goalId: string;
}): Promise<void> {
  await db.transaction('rw', db.goals, db.goalSteps, async () => {
    const goal = await getScopedGoal(scope, goalId);

    if (!goal) {
      return;
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goal.id);
    const deletedAt = createTimestamp();
    const deletedGoal = touchGoal(scope, {
      ...goal,
      deletedAt,
    });
    await persistGoalUpdate(scope, deletedGoal, ['deletedAt']);

    for (const goalStep of activeGoalSteps) {
      const deletedGoalStep = touchGoalStep(scope, {
        ...goalStep,
        deletedAt,
      });
      await persistGoalStepUpdate(scope, deletedGoalStep, ['deletedAt']);
    }
  });
}

export async function softDeleteGoalStep({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goals, db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goalStep.goalId);
    const childrenByParentId = new Map<string, GoalStep[]>();

    for (const activeGoalStep of activeGoalSteps) {
      if (!activeGoalStep.parentId) {
        continue;
      }

      const children = childrenByParentId.get(activeGoalStep.parentId) ?? [];
      children.push(activeGoalStep);
      childrenByParentId.set(activeGoalStep.parentId, children);
    }

    const goalStepIdsToDelete = new Set<string>();
    const visit = (parentGoalStepId: string) => {
      goalStepIdsToDelete.add(parentGoalStepId);

      for (const child of childrenByParentId.get(parentGoalStepId) ?? []) {
        visit(child.id);
      }
    };

    visit(goalStep.id);

    for (const activeGoalStep of activeGoalSteps) {
      if (!goalStepIdsToDelete.has(activeGoalStep.id)) {
        continue;
      }

      const updatedGoalStep = touchGoalStep(scope, {
        ...activeGoalStep,
        deletedAt: createTimestamp(),
      });
      await persistGoalStepUpdate(scope, updatedGoalStep, ['deletedAt']);
    }
  });
}

export async function indentGoalStep({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goalStep.goalId);
    const siblings = sortGoalSteps(
      activeGoalSteps.filter(
        (activeGoalStep) => activeGoalStep.parentId === goalStep.parentId,
      ),
    );
    const goalStepIndex = siblings.findIndex(
      (sibling) => sibling.id === goalStep.id,
    );
    const previousSibling = siblings[goalStepIndex - 1];

    if (!previousSibling) {
      return;
    }

    const newSiblings = activeGoalSteps.filter(
      (activeGoalStep) => activeGoalStep.parentId === previousSibling.id,
    );
    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      parentId: previousSibling.id,
      sortRank: createGoalStepInsertRank({ siblings: newSiblings }),
    });

    await persistGoalStepUpdate(scope, updatedGoalStep, [
      'parentId',
      'sortRank',
    ]);
  });
}

export async function moveGoalStepToParent({
  scope,
  goalStepId,
  parentGoalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
  parentGoalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep || goalStep.id === parentGoalStepId) {
      return;
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goalStep.goalId);
    const parentGoalStep = activeGoalSteps.find(
      (activeGoalStep) => activeGoalStep.id === parentGoalStepId,
    );

    if (!parentGoalStep) {
      return;
    }

    let ancestor: GoalStep | undefined = parentGoalStep;

    while (ancestor) {
      if (ancestor.id === goalStep.id) {
        return;
      }

      ancestor = ancestor.parentId
        ? activeGoalSteps.find(
            (activeGoalStep) => activeGoalStep.id === ancestor?.parentId,
          )
        : undefined;
    }

    const newSiblings = activeGoalSteps.filter(
      (activeGoalStep) => activeGoalStep.parentId === parentGoalStep.id,
    );
    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      parentId: parentGoalStep.id,
      sortRank: createGoalStepInsertRank({ siblings: newSiblings }),
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, [
      'parentId',
      'sortRank',
    ]);

    if (parentGoalStep.collapsed) {
      await persistGoalStepUpdate(
        scope,
        touchGoalStep(scope, { ...parentGoalStep, collapsed: false }),
        ['collapsed'],
      );
    }
  });
}

export async function moveGoalStepToTarget({
  scope,
  goalStepId,
  targetGoalStepId,
  placement,
}: {
  scope: AppScope;
  goalStepId: string;
  targetGoalStepId: string;
  placement: 'before' | 'after';
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep || goalStep.id === targetGoalStepId) return;

    const activeGoalSteps = await getActiveGoalSteps(scope, goalStep.goalId);
    const targetGoalStep = activeGoalSteps.find(
      (activeGoalStep) => activeGoalStep.id === targetGoalStepId,
    );
    const targetParentId = targetGoalStep?.parentId ?? null;

    if (!targetGoalStep) return;

    let ancestor = targetParentId
      ? activeGoalSteps.find(
          (activeGoalStep) => activeGoalStep.id === targetParentId,
        )
      : undefined;

    while (ancestor) {
      if (ancestor.id === goalStep.id) return;
      ancestor = ancestor.parentId
        ? activeGoalSteps.find(
            (activeGoalStep) => activeGoalStep.id === ancestor?.parentId,
          )
        : undefined;
    }

    const siblings = sortGoalSteps(
      activeGoalSteps.filter(
        (activeGoalStep) =>
          activeGoalStep.parentId === targetParentId &&
          activeGoalStep.id !== goalStep.id,
      ),
    );
    const targetIndex = siblings.findIndex(
      (sibling) => sibling.id === targetGoalStep.id,
    );

    if (targetIndex === -1) return;

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      parentId: targetParentId,
      sortRank:
        placement === 'before'
          ? createSortRankBetween(
              siblings[targetIndex - 1]?.sortRank ?? null,
              targetGoalStep.sortRank,
            )
          : createSortRankBetween(
              targetGoalStep.sortRank,
              siblings[targetIndex + 1]?.sortRank ?? null,
            ),
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, [
      'parentId',
      'sortRank',
    ]);
  });
}

export async function outdentGoalStep({
  scope,
  goalStepId,
}: {
  scope: AppScope;
  goalStepId: string;
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep?.parentId) {
      return;
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goalStep.goalId);
    const parentGoalStep = activeGoalSteps.find(
      (activeGoalStep) => activeGoalStep.id === goalStep.parentId,
    );

    if (!parentGoalStep) {
      return;
    }

    const newSiblings = sortGoalSteps(
      activeGoalSteps.filter(
        (activeGoalStep) => activeGoalStep.parentId === parentGoalStep.parentId,
      ),
    );
    const parentIndex = newSiblings.findIndex(
      (sibling) => sibling.id === parentGoalStep.id,
    );
    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      parentId: parentGoalStep.parentId,
      sortRank: createSortRankBetween(
        parentGoalStep.sortRank,
        newSiblings[parentIndex + 1]?.sortRank ?? null,
      ),
    });

    await persistGoalStepUpdate(scope, updatedGoalStep, [
      'parentId',
      'sortRank',
    ]);
  });
}

export async function reorderGoalStep({
  scope,
  goalStepId,
  direction,
}: {
  scope: AppScope;
  goalStepId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction('rw', db.goalSteps, async () => {
    const goalStep = await getScopedGoalStep(scope, goalStepId);

    if (!goalStep) {
      return;
    }

    const activeGoalSteps = await getActiveGoalSteps(scope, goalStep.goalId);
    const siblings = activeGoalSteps.filter(
      (activeGoalStep) => activeGoalStep.parentId === goalStep.parentId,
    );
    const sortRank = createReorderedRank({
      items: siblings,
      itemId: goalStep.id,
      direction,
    });

    if (!sortRank) {
      return;
    }

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      sortRank,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['sortRank']);
  });
}
