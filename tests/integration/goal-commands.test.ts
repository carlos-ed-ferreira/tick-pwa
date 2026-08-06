import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  assignGoalCategory,
  assignGoalStepCategory,
  completeGoal,
  createCategoryTag,
  createGoal,
  createGoalStep,
  createGoalStepChild,
  db,
  groupGoalsTogether,
  indentGoalStep,
  moveGoalStepToParent,
  moveGoalToGroup,
  outdentGoalStep,
  reorderGoal,
  reorderGoalStep,
  reopenGoal,
  softDeleteGoal,
  softDeleteGoalStep,
  setGoalStepsCompleted,
  toggleGoalStepChecked,
  toggleGoalStepBold,
  toggleGoalStepCollapsed,
  toggleGoalStepPriority,
  updateGoalDueDate,
  updateGoalStepScheduledDate,
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
    const goalCategory = await createCategoryTag({
      scope,
      surface: 'goal',
      name: 'Work',
      colorHex: '#2563eb',
    });
    const stepCategory = await createCategoryTag({
      scope,
      surface: 'goal_step',
      name: 'Home',
      colorHex: '#16a34a',
    });
    const firstGoal = await createGoal({
      scope,
      title: 'FIRST GOAL',
    });
    await createGoal({
      scope,
      afterGoalId: firstGoal.id,
      title: 'SECOND GOAL',
    });
    const insertedGoal = await createGoal({
      scope,
      afterGoalId: firstGoal.id,
      title: 'Inserted goal',
    });

    await updateGoalTitle({
      scope,
      goalId: insertedGoal.id,
      title: 'UPDATED INSERTED GOAL',
    });
    await assignGoalCategory({
      scope,
      goalId: insertedGoal.id,
      categoryTagId: goalCategory.id,
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
      text: 'Nested step',
    });
    await assignGoalStepCategory({
      scope,
      goalStepId: nestedGoalStep.id,
      categoryTagId: stepCategory.id,
    });
    await toggleGoalStepCollapsed({
      scope,
      goalStepId: rootGoalStep.id,
    });
    await toggleGoalStepPriority({
      scope,
      goalStepId: rootGoalStep.id,
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
      .where('scopeId')
      .equals(scope.id)
      .filter((goal) => goal.deletedAt === null && goal.completedAt === null)
      .sortBy('sortRank');

    expect(orderedGoals.map((goal) => goal.title)).toEqual([
      'FIRST GOAL',
      'UPDATED INSERTED GOAL',
      'SECOND GOAL',
    ]);

    const storedGoal = await db.goals.get(insertedGoal.id);
    const storedNestedGoalStep = await db.goalSteps.get(nestedGoalStep.id);
    const storedSiblingGoalStep = await db.goalSteps.get(siblingGoalStep.id);
    const storedRootGoalStep = await db.goalSteps.get(rootGoalStep.id);

    expect(storedGoal?.categoryTagId).toBe(goalCategory.id);
    expect(storedNestedGoalStep?.text).toBe('Nested step');
    expect(storedNestedGoalStep?.categoryTagId).toBe(stepCategory.id);
    expect(storedNestedGoalStep?.parentId).toBe(rootGoalStep.id);
    expect(storedRootGoalStep?.collapsed).toBe(true);
    expect(storedRootGoalStep?.priority).toBe(true);
    expect(storedSiblingGoalStep?.parentId).toBeNull();

    await softDeleteGoal({ scope, goalId: firstGoal.id });

    const remainingGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter((goal) => goal.deletedAt === null && goal.completedAt === null)
      .sortBy('sortRank');
    const deletedGoal = await db.goals.get(firstGoal.id);

    expect(remainingGoals.map((goal) => goal.title)).toEqual([
      'UPDATED INSERTED GOAL',
      'SECOND GOAL',
    ]);
    expect(deletedGoal?.deletedAt).not.toBeNull();
  });

  it('deletes an own-name category when the goal switches to another category', async () => {
    const scope = createGuestScope('goal-own-category-cleanup');
    const namedCategory = await createCategoryTag({
      scope,
      surface: 'goal',
      name: 'Work',
      colorHex: '#2563eb',
    });
    const ownCategory = await createCategoryTag({
      scope,
      surface: 'goal',
      name: '',
      colorHex: '#f59e0b',
      useOwnName: true,
    });
    const goal = await createGoal({ scope, title: 'Ship it' });

    await assignGoalCategory({
      scope,
      goalId: goal.id,
      categoryTagId: ownCategory.id,
    });
    await assignGoalCategory({
      scope,
      goalId: goal.id,
      categoryTagId: namedCategory.id,
    });

    const storedGoal = await db.goals.get(goal.id);
    const storedOwn = await db.categoryTags.get(ownCategory.id);
    const storedNamed = await db.categoryTags.get(namedCategory.id);

    expect(storedGoal?.categoryTagId).toBe(namedCategory.id);
    expect(storedOwn?.deletedAt).not.toBeNull();
    expect(storedNamed?.deletedAt).toBeNull();
  });

  it('deletes an own-name category when the goal category is cleared', async () => {
    const scope = createGuestScope('goal-own-category-clear');
    const ownCategory = await createCategoryTag({
      scope,
      surface: 'goal',
      name: '',
      colorHex: '#f59e0b',
      useOwnName: true,
    });
    const goal = await createGoal({ scope, title: 'Ship it' });

    await assignGoalCategory({
      scope,
      goalId: goal.id,
      categoryTagId: ownCategory.id,
    });
    await assignGoalCategory({
      scope,
      goalId: goal.id,
      categoryTagId: null,
    });

    const storedGoal = await db.goals.get(goal.id);
    const storedOwn = await db.categoryTags.get(ownCategory.id);

    expect(storedGoal?.categoryTagId).toBeNull();
    expect(storedOwn?.deletedAt).not.toBeNull();
  });

  it('moves a step under another step without creating a cycle', async () => {
    const scope = createGuestScope('goal-step-reparent');
    const goal = await createGoal({ scope, title: 'Ship feature' });
    const parent = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Parent',
    });
    const child = await createGoalStep({
      scope,
      goalId: goal.id,
      afterGoalStepId: parent.id,
      text: 'Child',
    });

    await moveGoalStepToParent({
      scope,
      goalStepId: child.id,
      parentGoalStepId: parent.id,
    });
    await moveGoalStepToParent({
      scope,
      goalStepId: parent.id,
      parentGoalStepId: child.id,
    });

    await expect(db.goalSteps.get(child.id)).resolves.toMatchObject({
      parentId: parent.id,
    });
    await expect(db.goalSteps.get(parent.id)).resolves.toMatchObject({
      parentId: null,
    });
  });

  it('does not persist empty goal steps or empty text updates', async () => {
    const scope = createGuestScope('goal-steps-empty-guard');
    const goal = await createGoal({ scope, title: 'Ship feature' });

    await expect(
      createGoalStep({
        scope,
        goalId: goal.id,
        text: '   ',
      }),
    ).rejects.toThrow(/require text/i);

    const step = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Keep me',
    });
    await updateGoalStepText({
      scope,
      goalStepId: step.id,
      text: '   ',
    });

    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      text: 'Keep me',
    });
  });

  it('bulk toggles selected goal steps within the same scope', async () => {
    const scope = createGuestScope('goal-steps-bulk-toggle');
    const goal = await createGoal({ scope, title: 'Ship feature' });
    const first = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'First',
    });
    const second = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Second',
    });

    await setGoalStepsCompleted({
      scope,
      goalStepIds: [first.id, second.id],
      completed: true,
    });

    await expect(db.goalSteps.get(first.id)).resolves.toMatchObject({
      completed: true,
    });
    await expect(db.goalSteps.get(second.id)).resolves.toMatchObject({
      completed: true,
    });

    await setGoalStepsCompleted({
      scope,
      goalStepIds: [first.id, second.id],
      completed: false,
      ignored: true,
    });

    await expect(db.goalSteps.get(first.id)).resolves.toMatchObject({
      completed: false,
      ignored: true,
    });
    await expect(db.goalSteps.get(second.id)).resolves.toMatchObject({
      completed: false,
      ignored: true,
    });
  });

  it('groups goals together and deletes a source group when it becomes empty', async () => {
    const scope = createGuestScope('goals-grouping-test');
    const firstGoal = await createGoal({ scope, title: 'Health' });
    const secondGoal = await createGoal({ scope, title: 'Work' });
    const thirdGoal = await createGoal({ scope, title: 'Study' });

    const group = await groupGoalsTogether({
      scope,
      sourceGoalId: secondGoal.id,
      targetGoalId: firstGoal.id,
      title: 'Life',
    });

    expect(group?.title).toBe('LIFE');
    await expect(db.goals.get(firstGoal.id)).resolves.toMatchObject({
      groupId: group?.id,
    });
    await expect(db.goals.get(secondGoal.id)).resolves.toMatchObject({
      groupId: group?.id,
    });

    await moveGoalToGroup({
      scope,
      goalId: firstGoal.id,
      groupId: null,
    });
    await moveGoalToGroup({
      scope,
      goalId: secondGoal.id,
      groupId: null,
    });

    await expect(db.goalGroups.get(group?.id ?? '')).resolves.toMatchObject({
      deletedAt: expect.any(String),
    });

    await groupGoalsTogether({
      scope,
      sourceGoalId: thirdGoal.id,
      targetGoalId: firstGoal.id,
      title: 'Focus',
    });

    const groupedGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter((goal) => goal.deletedAt === null && goal.groupId !== null)
      .toArray();

    expect(groupedGoals).toHaveLength(2);
  });

  it('archives completed goals and restores them without losing group or steps', async () => {
    const scope = createGuestScope('goals-archive-test');
    const goal = await createGoal({ scope, title: 'Ship feature' });
    const step = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Plan work',
    });

    await toggleGoalStepChecked({
      scope,
      goalStepId: step.id,
    });
    await completeGoal({ scope, goalId: goal.id });

    const completedGoal = await db.goals.get(goal.id);

    expect(completedGoal?.completedAt).not.toBeNull();

    await reopenGoal({ scope, goalId: goal.id });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      completedAt: null,
      title: 'SHIP FEATURE',
    });
    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      completed: true,
      text: 'Plan work',
    });
  });

  it('cycles goal steps through completed, ignored, and unchecked', async () => {
    const scope = createGuestScope('goal-step-ignore-cycle');
    const goal = await createGoal({ scope, title: 'Flexible goal' });
    const step = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Optional step',
    });

    await toggleGoalStepChecked({ scope, goalStepId: step.id });
    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      completed: true,
      ignored: false,
    });

    await toggleGoalStepChecked({ scope, goalStepId: step.id });
    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      completed: false,
      ignored: true,
    });

    await toggleGoalStepChecked({ scope, goalStepId: step.id });
    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      completed: false,
      ignored: false,
    });
  });

  it('toggles bold formatting for a goal step', async () => {
    const scope = createGuestScope('goal-step-bold');
    const goal = await createGoal({ scope, title: 'Important goal' });
    const step = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Important step',
    });

    await toggleGoalStepBold({ scope, goalStepId: step.id });
    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      bold: true,
    });

    await toggleGoalStepBold({ scope, goalStepId: step.id });
    await expect(db.goalSteps.get(step.id)).resolves.toMatchObject({
      bold: false,
    });
  });

  it('reorders goals and goal steps at the same level', async () => {
    const scope = createGuestScope('goals-reorder-test');
    const firstGoal = await createGoal({ scope, title: 'First goal' });
    const secondGoal = await createGoal({
      scope,
      afterGoalId: firstGoal.id,
      title: 'Second goal',
    });

    await reorderGoal({
      scope,
      goalId: secondGoal.id,
      direction: 'up',
    });

    const reorderedGoals = await db.goals
      .where('scopeId')
      .equals(scope.id)
      .filter((goal) => goal.deletedAt === null)
      .sortBy('sortRank');

    expect(reorderedGoals.map((goal) => goal.title)).toEqual([
      'SECOND GOAL',
      'FIRST GOAL',
    ]);

    const firstGoalStep = await createGoalStep({
      scope,
      goalId: firstGoal.id,
      text: 'First step',
    });
    const secondGoalStep = await createGoalStep({
      scope,
      goalId: firstGoal.id,
      afterGoalStepId: firstGoalStep.id,
      text: 'Second step',
    });
    const thirdGoalStep = await createGoalStep({
      scope,
      goalId: firstGoal.id,
      afterGoalStepId: secondGoalStep.id,
      text: 'Third step',
    });

    await reorderGoalStep({
      scope,
      goalStepId: thirdGoalStep.id,
      direction: 'up',
    });

    const reorderedGoalSteps = await db.goalSteps
      .where('[scopeId+goalId]')
      .equals([scope.id, firstGoal.id])
      .filter(
        (goalStep) => goalStep.deletedAt === null && goalStep.parentId === null,
      )
      .sortBy('sortRank');

    expect(reorderedGoalSteps.map((goalStep) => goalStep.text)).toEqual([
      'First step',
      'Third step',
      'Second step',
    ]);
  });

  it('cascades goal step deletion to descendants', async () => {
    const scope = createGuestScope('goals-delete-steps-test');
    const goal = await createGoal({ scope, title: 'Ship feature' });
    const rootGoalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Plan work',
    });
    const childGoalStep = await createGoalStepChild({
      scope,
      goalId: goal.id,
      parentGoalStepId: rootGoalStep.id,
      text: 'Child step',
    });

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

    expect(activeGoalSteps).toHaveLength(0);
    expect(deletedRootGoalStep?.deletedAt).not.toBeNull();
    expect(deletedChildGoalStep?.deletedAt).not.toBeNull();
  });

  it('sets, normalizes, and clears a goal due date', async () => {
    const scope = createGuestScope('goal-due-date-test');
    const goal = await createGoal({ scope, title: 'Ship feature' });

    await updateGoalDueDate({
      scope,
      goalId: goal.id,
      dueDate: '2026-08-20',
    });

    expect((await db.goals.get(goal.id))?.dueDate).toBe('2026-08-20');

    await updateGoalDueDate({
      scope,
      goalId: goal.id,
      dueDate: 'not-a-date',
    });

    expect((await db.goals.get(goal.id))?.dueDate).toBeNull();

    await updateGoalDueDate({
      scope,
      goalId: goal.id,
      dueDate: '2026-08-20',
    });
    await updateGoalDueDate({
      scope,
      goalId: goal.id,
      dueDate: null,
    });

    expect((await db.goals.get(goal.id))?.dueDate).toBeNull();
  });

  it('sets, normalizes, and clears a goal step scheduled date', async () => {
    const scope = createGuestScope('goal-step-date-test');
    const goal = await createGoal({ scope, title: 'Ship feature' });
    const step = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Plan work',
    });

    await updateGoalStepScheduledDate({
      scope,
      goalStepId: step.id,
      scheduledDate: '2026-08-20',
    });

    expect((await db.goalSteps.get(step.id))?.scheduledDate).toBe('2026-08-20');

    await updateGoalStepScheduledDate({
      scope,
      goalStepId: step.id,
      scheduledDate: 'not-a-date',
    });

    expect((await db.goalSteps.get(step.id))?.scheduledDate).toBeNull();

    await updateGoalStepScheduledDate({
      scope,
      goalStepId: step.id,
      scheduledDate: '2026-08-20',
    });
    await updateGoalStepScheduledDate({
      scope,
      goalStepId: step.id,
      scheduledDate: null,
    });

    expect((await db.goalSteps.get(step.id))?.scheduledDate).toBeNull();
  });

  it('accepts and normalizes a scheduled date at creation time', async () => {
    const scope = createGuestScope('goal-step-create-date-test');
    const goal = await createGoal({ scope, title: 'Ship feature' });

    const validStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Plan work',
      scheduledDate: '2026-08-20',
    });

    expect(validStep.scheduledDate).toBe('2026-08-20');

    const invalidStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Plan more work',
      scheduledDate: 'not-a-date',
    });

    expect(invalidStep.scheduledDate).toBeNull();
  });
});
