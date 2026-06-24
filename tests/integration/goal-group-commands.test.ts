import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  assignGoalGroupCategory,
  completeGoal,
  createCategoryTag,
  createGoal,
  createGoalGroup,
  db,
  moveGoalAfter,
  moveGoalBefore,
  moveGoalGroupAfter,
  moveGoalGroupBefore,
  moveGoalToGroup,
  reorderGoal,
  reorderGoalGroup,
  reopenGoal,
  softDeleteGoalGroup,
  updateGoalGroupTitle,
} from '@/lib/db';

describe('goal group commands', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates groups and supports grouped and ungrouped goals', async () => {
    const scope = createGuestScope('goal-groups');
    const group = await createGoalGroup({ scope, title: 'Health' });
    const secondGroup = await createGoalGroup({ scope, title: 'Work' });
    const groupedGoal = await createGoal({
      scope,
      groupId: group.id,
      title: 'Run a marathon',
    });
    const ungroupedGoal = await createGoal({
      scope,
      groupId: null,
      title: 'Read more',
    });

    expect(group.title).toBe('HEALTH');
    expect(groupedGoal.groupId).toBe(group.id);
    expect(ungroupedGoal.groupId).toBeNull();

    await moveGoalToGroup({
      scope,
      goalId: ungroupedGoal.id,
      groupId: group.id,
    });

    await expect(db.goals.get(ungroupedGoal.id)).resolves.toMatchObject({
      groupId: group.id,
    });

    await updateGoalGroupTitle({
      scope,
      goalGroupId: secondGroup.id,
      title: 'Career',
    });
    await reorderGoalGroup({
      scope,
      goalGroupId: secondGroup.id,
      direction: 'up',
    });
    await reorderGoal({
      scope,
      goalId: ungroupedGoal.id,
      direction: 'up',
    });

    await expect(db.goalGroups.get(secondGroup.id)).resolves.toMatchObject({
      title: 'CAREER',
    });

    await softDeleteGoalGroup({ scope, goalGroupId: group.id });
    await expect(db.goals.get(groupedGoal.id)).resolves.toMatchObject({
      groupId: null,
    });
  });

  it('moves goals and groups after a specific target', async () => {
    const scope = createGuestScope('goal-move-after');
    const firstGroup = await createGoalGroup({ scope, title: 'First group' });
    const secondGroup = await createGoalGroup({ scope, title: 'Second group' });
    const thirdGroup = await createGoalGroup({ scope, title: 'Third group' });
    const firstGoal = await createGoal({ scope, title: 'First goal' });
    const secondGoal = await createGoal({
      scope,
      afterGoalId: firstGoal.id,
      title: 'Second goal',
    });
    const thirdGoal = await createGoal({
      scope,
      afterGoalId: secondGoal.id,
      title: 'Third goal',
    });

    await moveGoalGroupAfter({
      scope,
      goalGroupId: firstGroup.id,
      targetGoalGroupId: thirdGroup.id,
    });
    await moveGoalAfter({
      scope,
      goalId: firstGoal.id,
      targetGoalId: thirdGoal.id,
    });

    const orderedGroups = await db.goalGroups
      .where('scopeId')
      .equals(scope.id)
      .filter((group) => group.deletedAt === null)
      .sortBy('sortRank');
    const orderedGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');

    expect(orderedGroups.map((group) => group.id)).toEqual([
      secondGroup.id,
      thirdGroup.id,
      firstGroup.id,
    ]);
    expect(orderedGoals.map((goal) => goal.title)).toEqual([
      'SECOND GOAL',
      'THIRD GOAL',
      'FIRST GOAL',
    ]);
  });

  it('moves goals and groups before a specific target', async () => {
    const scope = createGuestScope('goal-move-before');
    const firstGroup = await createGoalGroup({ scope, title: 'First group' });
    const secondGroup = await createGoalGroup({ scope, title: 'Second group' });
    const thirdGroup = await createGoalGroup({ scope, title: 'Third group' });
    const firstGoal = await createGoal({ scope, title: 'First goal' });
    const secondGoal = await createGoal({
      scope,
      afterGoalId: firstGoal.id,
      title: 'Second goal',
    });
    const thirdGoal = await createGoal({
      scope,
      afterGoalId: secondGoal.id,
      title: 'Third goal',
    });

    await moveGoalGroupBefore({
      scope,
      goalGroupId: thirdGroup.id,
      targetGoalGroupId: firstGroup.id,
    });
    await moveGoalBefore({
      scope,
      goalId: thirdGoal.id,
      targetGoalId: firstGoal.id,
    });

    const orderedGroups = await db.goalGroups
      .where('scopeId')
      .equals(scope.id)
      .filter((group) => group.deletedAt === null)
      .sortBy('sortRank');
    const orderedGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');

    expect(orderedGroups.map((group) => group.id)).toEqual([
      thirdGroup.id,
      firstGroup.id,
      secondGroup.id,
    ]);
    expect(orderedGoals.map((goal) => goal.title)).toEqual([
      'THIRD GOAL',
      'FIRST GOAL',
      'SECOND GOAL',
    ]);
  });

  it('uses independent categories for groups and goals', async () => {
    const scope = createGuestScope('goal-group-categories');
    const groupCategory = await createCategoryTag({
      scope,
      surface: 'goal_group',
      name: 'Personal',
      colorHex: '#2563eb',
    });
    const goalCategory = await createCategoryTag({
      scope,
      surface: 'goal',
      name: 'Health',
      colorHex: '#16a34a',
    });
    const group = await createGoalGroup({ scope, title: 'Life' });

    await assignGoalGroupCategory({
      scope,
      goalGroupId: group.id,
      categoryTagId: goalCategory.id,
    });
    await expect(db.goalGroups.get(group.id)).resolves.toMatchObject({
      categoryTagId: null,
    });

    await assignGoalGroupCategory({
      scope,
      goalGroupId: group.id,
      categoryTagId: groupCategory.id,
    });
    await expect(db.goalGroups.get(group.id)).resolves.toMatchObject({
      categoryTagId: groupCategory.id,
    });
  });

  it('archives completed goals and restores them when reopened', async () => {
    const scope = createGuestScope('completed-goals');
    const goal = await createGoal({ scope, title: 'Ship feature' });

    await completeGoal({ scope, goalId: goal.id });
    const completedGoal = await db.goals.get(goal.id);

    expect(completedGoal?.completedAt).not.toBeNull();

    await reopenGoal({ scope, goalId: goal.id });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      completedAt: null,
    });
  });
});
