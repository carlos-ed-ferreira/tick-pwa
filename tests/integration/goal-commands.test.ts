import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  assignGoalCategory,
  assignGoalStepCategory,
  createCategoryTag,
  createGoal,
  createGoalStep,
  createGoalStepChild,
  db,
  ensureDefaultNowGoal,
  indentGoalStep,
  mergeGoalsInCategory,
  outdentGoalStep,
  reorderGoalStep,
  softDeleteGoal,
  softDeleteGoalStep,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  updateGoalStepText,
  updateGoalTitle,
} from '@/lib/db';

describe('goal commands', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates, updates, sorts, and enriches goals with nested steps', async () => {
    const scope = createGuestScope('goals-test');
    const categoryTag = await createCategoryTag({
      scope,
      surface: 'goals',
      name: 'Work',
      colorHex: '#2563eb',
    });
    const firstGoal = await createGoal({
      scope,
      category: 'short',
      title: 'First goal',
    });
    await createGoal({
      scope,
      category: 'short',
      afterGoalId: firstGoal.id,
      title: 'Second goal',
    });
    const insertedGoal = await createGoal({
      scope,
      category: 'short',
      afterGoalId: firstGoal.id,
      title: 'Inserted goal',
    });

    await updateGoalTitle({
      scope,
      goalId: insertedGoal.id,
      title: 'Updated inserted goal',
    });
    await assignGoalCategory({
      scope,
      goalId: insertedGoal.id,
      categoryTagId: categoryTag.id,
    });

    const rootGoalStep = await createGoalStep({
      scope,
      goalId: insertedGoal.id,
      text: 'Root step',
    });
    const siblingGoalStep = await createGoalStep({
      scope,
      goalId: insertedGoal.id,
      afterGoalStepId: rootGoalStep.id,
      text: 'Second step',
    });
    const nestedGoalStep = await createGoalStepChild({
      scope,
      goalId: insertedGoal.id,
      parentGoalStepId: rootGoalStep.id,
    });

    await updateGoalStepText({
      scope,
      goalStepId: nestedGoalStep.id,
      text: 'Nested step',
    });
    await assignGoalStepCategory({
      scope,
      goalStepId: nestedGoalStep.id,
      categoryTagId: categoryTag.id,
    });
    await toggleGoalStepCollapsed({
      scope,
      goalStepId: rootGoalStep.id,
    });

    const reopenedChild = await createGoalStepChild({
      scope,
      goalId: insertedGoal.id,
      parentGoalStepId: rootGoalStep.id,
    });

    await updateGoalStepText({
      scope,
      goalStepId: reopenedChild.id,
      text: 'Second nested step',
    });
    await indentGoalStep({
      scope,
      goalStepId: siblingGoalStep.id,
    });
    await outdentGoalStep({
      scope,
      goalStepId: siblingGoalStep.id,
    });

    const orderedGoals = await db.goals
      .where('[scopeId+category]')
      .equals([scope.id, 'short'])
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');

    expect(orderedGoals.map((goal) => goal.title)).toEqual([
      'First goal',
      'Updated inserted goal',
      'Second goal',
    ]);

    const storedGoal = await db.goals.get(insertedGoal.id);
    const storedNestedGoalStep = await db.goalSteps.get(nestedGoalStep.id);
    const storedSiblingGoalStep = await db.goalSteps.get(siblingGoalStep.id);
    const storedRootGoalStep = await db.goalSteps.get(rootGoalStep.id);

    expect(storedGoal?.categoryTagId).toBe(categoryTag.id);
    expect(storedNestedGoalStep?.text).toBe('Nested step');
    expect(storedNestedGoalStep?.categoryTagId).toBe(categoryTag.id);
    expect(storedNestedGoalStep?.parentId).toBe(rootGoalStep.id);
    expect(storedRootGoalStep?.collapsed).toBe(false);
    expect(storedSiblingGoalStep?.parentId).toBeNull();

    await softDeleteGoal({ scope, goalId: firstGoal.id });

    const remainingGoals = await db.goals
      .where('[scopeId+category]')
      .equals([scope.id, 'short'])
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');
    const deletedGoal = await db.goals.get(firstGoal.id);
    const outboxCount = await db.syncOutbox.count();

    expect(remainingGoals.map((goal) => goal.title)).toEqual([
      'Updated inserted goal',
      'Second goal',
    ]);
    expect(deletedGoal?.deletedAt).not.toBeNull();
    expect(outboxCount).toBe(0);
  });

  it('recalculates progress and cascades goal step deletion', async () => {
    const scope = createGuestScope('goals-progress-test');
    const goal = await createGoal({
      scope,
      category: 'medium',
      title: 'Ship feature',
    });
    const rootGoalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Plan work',
    });
    const childGoalStep = await createGoalStepChild({
      scope,
      goalId: goal.id,
      parentGoalStepId: rootGoalStep.id,
    });

    await updateGoalStepText({
      scope,
      goalStepId: childGoalStep.id,
      text: 'Break down tasks',
    });
    await toggleGoalStepChecked({
      scope,
      goalStepId: childGoalStep.id,
    });

    let updatedGoal = await db.goals.get(goal.id);

    expect(updatedGoal?.progressValue).toBe(50);

    await softDeleteGoalStep({
      scope,
      goalStepId: rootGoalStep.id,
    });

    const activeGoalSteps = await db.goalSteps
      .where('[scopeId+goalId]')
      .equals([scope.id, goal.id])
      .filter((goalStep) => goalStep.deletedAt === null)
      .toArray();
    const deletedRootGoalStep = await db.goalSteps.get(rootGoalStep.id);
    const deletedChildGoalStep = await db.goalSteps.get(childGoalStep.id);

    updatedGoal = await db.goals.get(goal.id);

    expect(activeGoalSteps).toHaveLength(0);
    expect(deletedRootGoalStep?.deletedAt).not.toBeNull();
    expect(deletedChildGoalStep?.deletedAt).not.toBeNull();
    expect(updatedGoal?.progressValue).toBe(0);
  });

  it('creates and preserves the default now goal', async () => {
    const scope = createGuestScope('goals-now-test');

    const defaultGoal = await ensureDefaultNowGoal({
      scope,
      title: 'Focus now',
    });
    await createGoal({
      scope,
      category: 'now',
      afterGoalId: defaultGoal.id,
      title: 'Custom focus',
    });
    const ensuredGoal = await ensureDefaultNowGoal({
      scope,
      title: 'Focus now',
    });
    const nowGoals = await db.goals
      .where('[scopeId+category]')
      .equals([scope.id, 'now'])
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');
    const outboxCount = await db.syncOutbox.count();

    expect(ensuredGoal.id).toBe(defaultGoal.id);
    expect(nowGoals.map((goal) => goal.title)).toEqual([
      'Focus now',
      'Custom focus',
    ]);
    expect(outboxCount).toBe(0);
  });

  it('merges legacy goals from the same category into a single container', async () => {
    const scope = createGuestScope('goals-merge-test');
    const firstGoal = await createGoal({
      scope,
      category: 'long',
      title: 'Primary',
    });
    const secondGoal = await createGoal({
      scope,
      category: 'long',
      afterGoalId: firstGoal.id,
      title: 'Legacy',
    });
    const firstRootStep = await createGoalStep({
      scope,
      goalId: firstGoal.id,
      text: 'Keep this first',
    });
    const secondRootStep = await createGoalStep({
      scope,
      goalId: secondGoal.id,
      text: 'Move this over',
    });
    const nestedSecondStep = await createGoalStepChild({
      scope,
      goalId: secondGoal.id,
      parentGoalStepId: secondRootStep.id,
    });

    await updateGoalStepText({
      scope,
      goalStepId: nestedSecondStep.id,
      text: 'Nested legacy item',
    });

    const mergedGoal = await mergeGoalsInCategory({
      scope,
      category: 'long',
    });
    const activeGoals = await db.goals
      .where('[scopeId+category]')
      .equals([scope.id, 'long'])
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');
    const movedRootStep = await db.goalSteps.get(secondRootStep.id);
    const movedNestedStep = await db.goalSteps.get(nestedSecondStep.id);
    const remainingRootSteps = await db.goalSteps
      .where('[scopeId+goalId]')
      .equals([scope.id, firstGoal.id])
      .filter(
        (goalStep) => goalStep.deletedAt === null && goalStep.parentId === null,
      )
      .sortBy('sortRank');
    const deletedLegacyGoal = await db.goals.get(secondGoal.id);

    expect(mergedGoal?.id).toBe(firstGoal.id);
    expect(activeGoals).toHaveLength(1);
    expect(movedRootStep?.goalId).toBe(firstGoal.id);
    expect(movedNestedStep?.goalId).toBe(firstGoal.id);
    expect(movedNestedStep?.parentId).toBe(secondRootStep.id);
    expect(remainingRootSteps.map((goalStep) => goalStep.id)).toEqual([
      firstRootStep.id,
      secondRootStep.id,
    ]);
    expect(deletedLegacyGoal?.deletedAt).not.toBeNull();
  });

  it('reorders goal steps at the same level', async () => {
    const scope = createGuestScope('goals-reorder-test');
    const goal = await createGoal({
      scope,
      category: 'short',
      title: 'Goal',
    });
    const firstGoalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'First step',
    });
    const secondGoalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      afterGoalStepId: firstGoalStep.id,
      text: 'Second step',
    });
    const thirdGoalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      afterGoalStepId: secondGoalStep.id,
      text: 'Third step',
    });

    await reorderGoalStep({
      scope,
      goalStepId: thirdGoalStep.id,
      direction: 'up',
    });

    let reorderedGoalSteps = await db.goalSteps
      .where('[scopeId+goalId]')
      .equals([scope.id, goal.id])
      .filter(
        (goalStep) => goalStep.deletedAt === null && goalStep.parentId === null,
      )
      .sortBy('sortRank');

    expect(reorderedGoalSteps.map((goalStep) => goalStep.text)).toEqual([
      'First step',
      'Third step',
      'Second step',
    ]);

    const nestedSecondGoalStep = await createGoalStepChild({
      scope,
      goalId: goal.id,
      parentGoalStepId: firstGoalStep.id,
    });
    await updateGoalStepText({
      scope,
      goalStepId: nestedSecondGoalStep.id,
      text: 'Nested second step',
    });
    const nestedThirdGoalStep = await createGoalStepChild({
      scope,
      goalId: goal.id,
      parentGoalStepId: firstGoalStep.id,
    });
    await updateGoalStepText({
      scope,
      goalStepId: nestedThirdGoalStep.id,
      text: 'Nested third step',
    });

    await reorderGoalStep({
      scope,
      goalStepId: nestedThirdGoalStep.id,
      direction: 'up',
    });

    reorderedGoalSteps = await db.goalSteps
      .where('[scopeId+goalId]')
      .equals([scope.id, goal.id])
      .filter(
        (goalStep) =>
          goalStep.deletedAt === null && goalStep.parentId === firstGoalStep.id,
      )
      .sortBy('sortRank');

    expect(reorderedGoalSteps.map((goalStep) => goalStep.text)).toEqual([
      'Nested third step',
      'Nested second step',
    ]);
  });
});
