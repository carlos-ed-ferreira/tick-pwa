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
  indentGoalStep,
  mergeGoalsInCategory,
  outdentGoalStep,
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
});
