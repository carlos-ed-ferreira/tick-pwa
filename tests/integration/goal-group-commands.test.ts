import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  assignGoalGroupCategory,
  completeGoal,
  createCategoryTag,
  createGoal,
  createGoalGroup,
  db,
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
