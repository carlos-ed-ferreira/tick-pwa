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
  compareSortRanks,
  sortByRank,
} from '@/lib/domain';
import { db } from './database';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { persistAccountEntityChange } from './account-persistence';

function sortGoals(goals: Goal[]): Goal[] {
  return sortByRank(goals);
}

function sortGroupedGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((firstGoal, secondGoal) => {
    const rankOrder = compareSortRanks(firstGoal.sortRank, secondGoal.sortRank);

    if (rankOrder !== 0) {
      return rankOrder;
    }

    const createdAtOrder = firstGoal.createdAt.localeCompare(
      secondGoal.createdAt,
    );

    if (createdAtOrder !== 0) {
      return createdAtOrder;
    }

    return firstGoal.id.localeCompare(secondGoal.id);
  });
}

function normalizeGoalTitle(title: string): string {
  return title.normalize('NFC').trim().toLocaleUpperCase();
}

function sortGoalSteps(goalSteps: GoalStep[]): GoalStep[] {
  return sortByRank(goalSteps);
}

async function getActiveGoals(
  scope: AppScope,
  category: GoalCategory,
): Promise<Goal[]> {
  return db.goals
    .where('[scopeId+category]')
    .equals([scope.id, category])
    .filter((goal) => goal.deletedAt === null && goal.archivedAt === null)
    .toArray();
}

function collectGoalStepDescendants(
  goalSteps: GoalStep[],
  parentGoalStepId: string,
): GoalStep[] {
  const descendants: GoalStep[] = [];
  const stack = [parentGoalStepId];

  while (stack.length > 0) {
    const currentParentId = stack.pop();

    if (!currentParentId) {
      continue;
    }

    for (const goalStep of goalSteps) {
      if (goalStep.parentId !== currentParentId) {
        continue;
      }

      descendants.push(goalStep);
      stack.push(goalStep.id);
    }
  }

  return descendants;
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

    await persistGoalGroupUpdate(
      scope,
      touchGoalGroup(scope, { ...group, categoryTagId: safeCategoryTagId }),
      ['categoryTagId'],
    );
  });
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

async function syncGoalProgressFromSteps({
  scope,
  goalId,
}: {
  scope: AppScope;
  goalId: string;
}): Promise<void> {
  const goal = await getScopedGoal(scope, goalId);

  if (!goal || goal.progressMode !== 'steps') {
    return;
  }

  const activeGoalSteps = await getActiveGoalSteps(scope, goalId);
  const completedGoalSteps = activeGoalSteps.filter(
    (goalStep) => goalStep.completed,
  );
  const nextProgressValue =
    activeGoalSteps.length === 0
      ? 0
      : Math.round((completedGoalSteps.length / activeGoalSteps.length) * 100);

  if (goal.progressValue === nextProgressValue) {
    return;
  }

  const updatedGoal = touchGoal(scope, {
    ...goal,
    progressValue: nextProgressValue,
  });
  await persistGoalUpdate(scope, updatedGoal, ['progressValue']);
}

export async function createGoal({
  scope,
  category = 'now',
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
  return db.transaction('rw', db.goalGroups, db.goals, async () => {
    const group = groupId ? await db.goalGroups.get(groupId) : null;
    const safeGroupId =
      group && group.scopeId === scope.id && !group.deletedAt ? group.id : null;
    const activeGoals = (await getActiveGoals(scope, category)).filter(
      (goal) => goal.groupId === safeGroupId,
    );
    const now = createTimestamp();
    const normalizedTitle = normalizeGoalTitle(title);
    const goal: Goal = {
      id: createId(),
      scopeId: scope.id,
      groupId: safeGroupId,
      category,
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

export async function ensureDefaultNowGoal({
  scope,
  title,
}: {
  scope: AppScope;
  title: string;
}): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const activeGoals = sortGoals(await getActiveGoals(scope, 'now'));
    const defaultGoal = activeGoals[0];
    const normalizedTitle = normalizeGoalTitle(title);

    if (!defaultGoal) {
      const now = createTimestamp();
      const goal: Goal = {
        id: createId(),
        scopeId: scope.id,
        groupId: null,
        category: 'now',
        title: normalizedTitle,
        description: '',
        status: 'active',
        progressMode: 'steps',
        progressValue: 0,
        dueDate: null,
        categoryTagId: null,
        sortRank: createGoalInsertRank({ siblings: [] }),
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
    }

    if (defaultGoal.title === normalizedTitle) {
      return defaultGoal;
    }

    const updatedGoal = touchGoal(scope, {
      ...defaultGoal,
      title: normalizedTitle,
    });
    await persistGoalUpdate(scope, updatedGoal, ['title']);

    return updatedGoal;
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
        !['goal', 'goals'].includes(categoryTag.surface))
    ) {
      return;
    }

    const safeCategoryTagId = categoryTag?.id ?? null;

    if (goal.categoryTagId === safeCategoryTagId) {
      return;
    }

    const updatedGoal = touchGoal(scope, {
      ...goal,
      categoryTagId: safeCategoryTagId,
    });
    await persistGoalUpdate(scope, updatedGoal, ['categoryTagId']);
  });
}

export async function createGoalStep({
  scope,
  goalId,
  id = createId(),
  parentId = null,
  afterGoalStepId = null,
  text = '',
}: {
  scope: AppScope;
  goalId: string;
  id?: string;
  parentId?: string | null;
  afterGoalStepId?: string | null;
  text?: string;
}): Promise<GoalStep> {
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

    await syncGoalProgressFromSteps({ scope, goalId });

    return goalStep;
  });
}

export async function createGoalStepChild({
  scope,
  goalId,
  parentGoalStepId,
}: {
  scope: AppScope;
  goalId: string;
  parentGoalStepId: string;
}): Promise<GoalStep> {
  return createGoalStep({
    scope,
    goalId,
    parentId: parentGoalStepId,
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

    const updatedGoalStep = touchGoalStep(scope, {
      ...goalStep,
      completed: !goalStep.completed,
    });
    await persistGoalStepUpdate(scope, updatedGoalStep, ['completed']);
    await syncGoalProgressFromSteps({ scope, goalId: goalStep.goalId });
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
        !['goal_step', 'goals'].includes(categoryTag.surface))
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

export async function mergeGoalsInCategory({
  scope,
  category,
}: {
  scope: AppScope;
  category: GoalCategory;
}): Promise<Goal | null> {
  return db.transaction('rw', db.goals, db.goalSteps, async () => {
    const activeGoals = sortGoals(await getActiveGoals(scope, category));

    if (activeGoals.length === 0) {
      return null;
    }

    const [primaryGoal, ...legacyGoals] = activeGoals;

    if (legacyGoals.length === 0) {
      return primaryGoal;
    }

    let primaryGoalSteps = await getActiveGoalSteps(scope, primaryGoal.id);
    let lastRootSortRank =
      sortGoalSteps(
        primaryGoalSteps.filter((goalStep) => goalStep.parentId === null),
      ).at(-1)?.sortRank ?? null;

    for (const legacyGoal of legacyGoals) {
      const legacyGoalSteps = await getActiveGoalSteps(scope, legacyGoal.id);
      const rootGoalSteps = sortGoalSteps(
        legacyGoalSteps.filter((goalStep) => goalStep.parentId === null),
      );

      for (const rootGoalStep of rootGoalSteps) {
        const nextRootSortRank = createSortRankBetween(lastRootSortRank, null);
        const movedRootGoalStep = touchGoalStep(scope, {
          ...rootGoalStep,
          goalId: primaryGoal.id,
          sortRank: nextRootSortRank,
        });

        await persistGoalStepUpdate(scope, movedRootGoalStep, [
          'goalId',
          'sortRank',
        ]);

        for (const descendantGoalStep of collectGoalStepDescendants(
          legacyGoalSteps,
          rootGoalStep.id,
        )) {
          const movedDescendantGoalStep = touchGoalStep(scope, {
            ...descendantGoalStep,
            goalId: primaryGoal.id,
          });

          await persistGoalStepUpdate(scope, movedDescendantGoalStep, [
            'goalId',
          ]);
        }

        lastRootSortRank = nextRootSortRank;
      }

      const archivedLegacyGoal = touchGoal(scope, {
        ...legacyGoal,
        deletedAt: createTimestamp(),
      });
      await persistGoalUpdate(scope, archivedLegacyGoal, ['deletedAt']);

      primaryGoalSteps = await getActiveGoalSteps(scope, primaryGoal.id);
      lastRootSortRank =
        sortGoalSteps(
          primaryGoalSteps.filter((goalStep) => goalStep.parentId === null),
        ).at(-1)?.sortRank ?? lastRootSortRank;
    }

    await syncGoalProgressFromSteps({ scope, goalId: primaryGoal.id });

    return (await getScopedGoal(scope, primaryGoal.id)) ?? primaryGoal;
  });
}

export async function mergeGoalsInCategoryTag({
  scope,
  categoryTagId,
}: {
  scope: AppScope;
  categoryTagId: string;
}): Promise<Goal | null> {
  return db.transaction(
    'rw',
    db.goals,
    db.goalSteps,
    db.categoryTags,
    async () => {
      const categoryTag = await db.categoryTags.get(categoryTagId);

      if (
        !categoryTag ||
        categoryTag.scopeId !== scope.id ||
        categoryTag.deletedAt ||
        !['goal', 'goals'].includes(categoryTag.surface)
      ) {
        return null;
      }

      const activeGoals = sortGroupedGoals(
        await db.goals
          .where('scopeId')
          .equals(scope.id)
          .filter(
            (goal) =>
              goal.deletedAt === null &&
              goal.archivedAt === null &&
              goal.categoryTagId === categoryTag.id,
          )
          .toArray(),
      );

      if (activeGoals.length === 0) {
        return null;
      }

      const [primaryGoal, ...legacyGoals] = activeGoals;

      if (legacyGoals.length === 0) {
        return primaryGoal;
      }

      let primaryGoalSteps = await getActiveGoalSteps(scope, primaryGoal.id);
      let lastRootSortRank =
        sortGoalSteps(
          primaryGoalSteps.filter((goalStep) => goalStep.parentId === null),
        ).at(-1)?.sortRank ?? null;

      for (const legacyGoal of legacyGoals) {
        const legacyGoalSteps = await getActiveGoalSteps(scope, legacyGoal.id);
        const rootGoalSteps = sortGoalSteps(
          legacyGoalSteps.filter((goalStep) => goalStep.parentId === null),
        );

        for (const rootGoalStep of rootGoalSteps) {
          const nextRootSortRank = createSortRankBetween(
            lastRootSortRank,
            null,
          );
          const movedRootGoalStep = touchGoalStep(scope, {
            ...rootGoalStep,
            goalId: primaryGoal.id,
            sortRank: nextRootSortRank,
          });

          await persistGoalStepUpdate(scope, movedRootGoalStep, [
            'goalId',
            'sortRank',
          ]);

          for (const descendantGoalStep of collectGoalStepDescendants(
            legacyGoalSteps,
            rootGoalStep.id,
          )) {
            const movedDescendantGoalStep = touchGoalStep(scope, {
              ...descendantGoalStep,
              goalId: primaryGoal.id,
            });

            await persistGoalStepUpdate(scope, movedDescendantGoalStep, [
              'goalId',
            ]);
          }

          lastRootSortRank = nextRootSortRank;
        }

        const deletedLegacyGoal = touchGoal(scope, {
          ...legacyGoal,
          deletedAt: createTimestamp(),
        });
        await persistGoalUpdate(scope, deletedLegacyGoal, ['deletedAt']);

        primaryGoalSteps = await getActiveGoalSteps(scope, primaryGoal.id);
        lastRootSortRank =
          sortGoalSteps(
            primaryGoalSteps.filter((goalStep) => goalStep.parentId === null),
          ).at(-1)?.sortRank ?? lastRootSortRank;
      }

      return primaryGoal;
    },
  );
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

    await syncGoalProgressFromSteps({ scope, goalId: goalStep.goalId });
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
