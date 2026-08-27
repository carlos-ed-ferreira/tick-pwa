import { describe, expect, it } from 'vitest';
import { summarizeGoalSteps } from '@/features/goals/use-goal-step-summaries';
import type { GoalStep } from '@/lib/domain';

function step(overrides: Partial<GoalStep>): GoalStep {
  return {
    id: 'step-1',
    scopeId: 'guest:test',
    goalId: 'goal-1',
    parentId: null,
    text: 'Step',
    completed: false,
    ignored: false,
    bold: false,
    priority: false,
    collapsed: false,
    categoryTagId: null,
    scheduledDate: null,
    sortRank: 'a0',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    clientUpdatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as GoalStep;
}

describe('summarizeGoalSteps', () => {
  it('counts ignored steps apart from the progress ratio', () => {
    const summaries = summarizeGoalSteps([
      step({ id: 'step-1', completed: true }),
      step({ id: 'step-2', completed: true }),
      step({ id: 'step-3', ignored: true }),
      step({ id: 'step-4', ignored: true, completed: true }),
    ]);
    const summary = summaries.get('goal-1');

    expect(summary?.itemCount).toBe(2);
    expect(summary?.completedCount).toBe(2);
    expect(summary?.ignoredCount).toBe(2);
  });

  it('keeps ignored steps out of the category summaries', () => {
    const summaries = summarizeGoalSteps([
      step({ id: 'step-1', categoryTagId: 'category-1', completed: true }),
      step({ id: 'step-2', categoryTagId: 'category-2', ignored: true }),
    ]);
    const summary = summaries.get('goal-1');

    expect(summary?.categoryTagIds).toEqual(['category-1']);
    expect(summary?.ignoredCount).toBe(1);
  });

  it('summarizes a goal that only has ignored steps', () => {
    const summaries = summarizeGoalSteps([
      step({ id: 'step-1', ignored: true }),
      step({ id: 'step-2', goalId: 'goal-2' }),
    ]);

    expect(summaries.get('goal-1')).toEqual({
      completedCount: 0,
      itemCount: 0,
      ignoredCount: 1,
      categoryTagIds: [],
      categorySummaries: new Map(),
    });
  });
});
