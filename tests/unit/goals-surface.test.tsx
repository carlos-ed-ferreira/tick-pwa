import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';

const {
  createGoalMock,
  createGoalStepMock,
  mergeGoalsInCategoryMock,
  reorderGoalStepMock,
  softDeleteGoalStepMock,
  updateGoalStepTextMock,
  useGoalsMock,
  useGoalStepTreeMock,
} = vi.hoisted(() => ({
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  mergeGoalsInCategoryMock: vi.fn().mockResolvedValue(null),
  reorderGoalStepMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStepMock: vi.fn().mockResolvedValue(undefined),
  updateGoalStepTextMock: vi.fn().mockResolvedValue(undefined),
  useGoalsMock: vi.fn(),
  useGoalStepTreeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  assignGoalStepCategory: vi.fn().mockResolvedValue(undefined),
  createGoal: createGoalMock,
  createGoalStep: createGoalStepMock,
  createGoalStepChild: vi.fn().mockResolvedValue(undefined),
  indentGoalStep: vi.fn().mockResolvedValue(undefined),
  mergeGoalsInCategory: mergeGoalsInCategoryMock,
  outdentGoalStep: vi.fn().mockResolvedValue(undefined),
  reorderGoalStep: reorderGoalStepMock,
  softDeleteGoalStep: softDeleteGoalStepMock,
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: vi.fn().mockResolvedValue(undefined),
  updateGoalStepText: updateGoalStepTextMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      dayEditor: {
        expandItem: 'Expand item',
        collapseItem: 'Collapse item',
        toggleItem: 'Toggle item',
        itemPlaceholder: 'Write a task',
        addChild: 'Add child',
        indentItem: 'Indent item',
        moveItemDown: 'Move item down',
        moveItemUp: 'Move item up',
        outdentItem: 'Outdent item',
        deleteItem: 'Delete item',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        confirmDeleteItem: 'This item has content. Delete it anyway?',
        selectItem: 'Select item',
        deselectItem: 'Deselect item',
        itemsSelected: '{count} selected',
        bulkDeleteItems: 'Delete selected',
        confirmBulkDeleteItems: 'This will delete {count} items. Continue?',
        clearSelection: 'Clear selection',
      },
      goals: {
        categories: {
          short: 'Short term',
          medium: 'Medium term',
          long: 'Long term',
        },
        addGoal: 'Add goal',
        addGoalAfter: 'Add goal below',
        addStep: 'Add item',
        emptyCategory: 'Start this section with a checklist item',
        emptyGoal: 'Start this goal with a checklist item',
        goalPlaceholder: 'Write a goal',
        deleteGoal: 'Delete goal',
        confirmDeleteGoal: 'This goal has content. Delete it anyway?',
        progress: 'Progress',
        title: 'Goals',
      },
      actions: {
        cancel: 'Cancel',
        delete: 'Delete',
      },
    },
    scope: {
      id: 'guest:test',
      kind: 'guest',
      ownerId: 'test',
    },
  }),
}));

vi.mock('@/features/categories', () => ({
  CategoryAssignmentMenu: () => null,
  useCategoryTags: () => [],
}));

vi.mock('@/features/goals/use-goals', () => ({
  useGoals: useGoalsMock,
}));

vi.mock('@/features/goals/use-goal-step-tree', () => ({
  useGoalStepTree: useGoalStepTreeMock,
}));

describe('GoalsSurface', () => {
  beforeEach(() => {
    createGoalMock.mockReset();
    createGoalMock.mockResolvedValue({ id: 'goal-short' });
    createGoalStepMock.mockReset();
    createGoalStepMock.mockResolvedValue(undefined);
    mergeGoalsInCategoryMock.mockClear();
    reorderGoalStepMock.mockClear();
    softDeleteGoalStepMock.mockClear();
    updateGoalStepTextMock.mockClear();
    useGoalsMock.mockReset();
    useGoalsMock.mockImplementation((_scope, category) =>
      category === 'short' ? [] : [{ id: `${category}-goal` }],
    );
    useGoalStepTreeMock.mockReset();
    useGoalStepTreeMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('creates the first item directly inside a term section without rendering goal inputs', async () => {
    render(<GoalsSurface />);

    expect(
      screen.queryByPlaceholderText('Write a goal'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add goal' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Start this section with a checklist item',
      })[0],
    );

    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        category: 'short',
      });
    });
    expect(createGoalStepMock).toHaveBeenCalledWith({
      scope: {
        id: 'guest:test',
        kind: 'guest',
        ownerId: 'test',
      },
      goalId: 'goal-short',
    });
  });

  it('reorders a goal step when clicking the move controls', async () => {
    useGoalsMock.mockImplementation(() => [{ id: 'goal-medium' }]);
    useGoalStepTreeMock.mockReturnValue([
      {
        goalStep: {
          id: 'goal-step-1',
          goalId: 'goal-medium',
          parentId: null,
          text: 'Existing step',
          completed: false,
          collapsed: false,
          categoryTagId: null,
          sortRank: 'U',
        },
        depth: 0,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: false,
        isLastSibling: false,
      },
    ]);

    render(<GoalsSurface />);

    fireEvent.click(screen.getAllByLabelText('Move item up')[0]);

    await waitFor(() => {
      expect(reorderGoalStepMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        goalStepId: 'goal-step-1',
        direction: 'up',
      });
    });
  });

  it('flushes edited goal step text before creating a sibling with Enter', async () => {
    useGoalsMock.mockImplementation(() => [{ id: 'goal-medium' }]);
    createGoalStepMock.mockResolvedValue({ id: 'new-goal-step' });
    useGoalStepTreeMock.mockReturnValue([
      {
        goalStep: {
          id: 'goal-step-1',
          goalId: 'goal-medium',
          parentId: null,
          text: 'Existing step',
          completed: false,
          collapsed: false,
          categoryTagId: null,
          sortRank: 'U',
        },
        depth: 0,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: false,
        isLastSibling: false,
      },
    ]);

    render(<GoalsSurface />);

    const input = screen.getAllByDisplayValue('Existing step')[0];
    fireEvent.change(input, { target: { value: 'Edited step' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        goalId: 'goal-medium',
        parentId: null,
        afterGoalStepId: 'goal-step-1',
      });
    });
    expect(updateGoalStepTextMock).toHaveBeenCalledWith({
      scope: {
        id: 'guest:test',
        kind: 'guest',
        ownerId: 'test',
      },
      goalStepId: 'goal-step-1',
      text: 'Edited step',
    });
    expect(updateGoalStepTextMock.mock.invocationCallOrder[0]).toBeLessThan(
      createGoalStepMock.mock.invocationCallOrder[0],
    );
  });

  it('bulk deletes a selected goal step from selection mode', async () => {
    useGoalsMock.mockImplementation(() => [{ id: 'goal-medium' }]);
    useGoalStepTreeMock.mockReturnValue([
      {
        goalStep: {
          id: 'goal-step-1',
          goalId: 'goal-medium',
          parentId: null,
          text: 'Existing step',
          completed: false,
          collapsed: false,
          categoryTagId: null,
          sortRank: 'U',
        },
        depth: 0,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: false,
        isLastSibling: false,
      },
    ]);

    render(<GoalsSurface />);

    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(screen.getAllByLabelText('Delete item')[0]);

    expect(
      await screen.findByText('This will delete 1 items. Continue?'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        goalStepId: 'goal-step-1',
      });
    });
  });
});
