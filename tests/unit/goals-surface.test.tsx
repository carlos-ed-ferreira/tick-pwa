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
  ensureDefaultNowGoalMock,
  mergeGoalsInCategoryMock,
  reorderGoalStepMock,
  requestSyncMock,
  softDeleteGoalMock,
  softDeleteGoalStepMock,
  updateGoalTitleMock,
  updateGoalStepTextMock,
  useGoalsMock,
  useGoalStepTreeMock,
} = vi.hoisted(() => ({
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  ensureDefaultNowGoalMock: vi.fn().mockResolvedValue({ id: 'goal-now' }),
  mergeGoalsInCategoryMock: vi.fn().mockResolvedValue(null),
  reorderGoalStepMock: vi.fn().mockResolvedValue(undefined),
  requestSyncMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStepMock: vi.fn().mockResolvedValue(undefined),
  updateGoalTitleMock: vi.fn().mockResolvedValue(undefined),
  updateGoalStepTextMock: vi.fn().mockResolvedValue(undefined),
  useGoalsMock: vi.fn(),
  useGoalStepTreeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  assignGoalStepCategory: vi.fn().mockResolvedValue(undefined),
  createGoal: createGoalMock,
  createGoalStep: createGoalStepMock,
  createGoalStepChild: vi.fn().mockResolvedValue(undefined),
  ensureDefaultNowGoal: ensureDefaultNowGoalMock,
  indentGoalStep: vi.fn().mockResolvedValue(undefined),
  mergeGoalsInCategory: mergeGoalsInCategoryMock,
  outdentGoalStep: vi.fn().mockResolvedValue(undefined),
  reorderGoalStep: reorderGoalStepMock,
  softDeleteGoal: softDeleteGoalMock,
  softDeleteGoalStep: softDeleteGoalStepMock,
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: vi.fn().mockResolvedValue(undefined),
  updateGoalTitle: updateGoalTitleMock,
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
          now: 'Focus now',
        },
        introFutureDescription:
          'Organize goals by horizon: short, medium, and long term.',
        introNowDescription:
          'Track pending goals and commitments that need attention soon.',
        futureTitle: 'Horizons',
        futureDescription: 'Future goals by short, medium, and long term.',
        nowTitle: 'Focus now',
        nowDescription: 'Goals and pending work to act on soon.',
        backToGoalGroups: 'Back to goal groups',
        addNowGoal: 'Create card',
        newNowGoalTitle: 'New focus',
        nowGoalPlaceholder: 'Card name',
        renameNowGoal: 'Rename card',
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
    requestSync: requestSyncMock,
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
    ensureDefaultNowGoalMock.mockClear();
    mergeGoalsInCategoryMock.mockClear();
    reorderGoalStepMock.mockClear();
    softDeleteGoalMock.mockClear();
    softDeleteGoalStepMock.mockClear();
    updateGoalTitleMock.mockClear();
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

  it('renders goal group cards before loading goal cards', () => {
    render(<GoalsSurface />);

    expect(
      screen.getByRole('button', { name: /Horizons/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Focus now/ }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Short term')).not.toBeInTheDocument();
  });

  it('creates the first item directly inside a term section without rendering goal inputs', async () => {
    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /Horizons/ }));

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
    fireEvent.click(screen.getByRole('button', { name: /Horizons/ }));

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
    fireEvent.click(screen.getByRole('button', { name: /Horizons/ }));

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
    fireEvent.click(screen.getByRole('button', { name: /Horizons/ }));

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

  it('ensures the default now card when opening focus now', async () => {
    useGoalsMock.mockImplementation((_scope, category) =>
      category === 'now' ? [] : [],
    );

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /Focus now/ }));

    await waitFor(() => {
      expect(ensureDefaultNowGoalMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        title: 'Focus now',
      });
    });
  });

  it('creates, renames, and deletes custom now cards without deleting the default card', async () => {
    useGoalsMock.mockImplementation((_scope, category) =>
      category === 'now'
        ? [
            { id: 'goal-now-default', title: 'Focus now' },
            { id: 'goal-now-custom', title: 'Side project' },
          ]
        : [],
    );
    useGoalStepTreeMock.mockImplementation((_scope, goalId) =>
      goalId === 'goal-now-custom'
        ? [
            {
              goalStep: {
                id: 'goal-step-custom',
                goalId: 'goal-now-custom',
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
              isFirstSibling: true,
              isLastSibling: true,
            },
          ]
        : [],
    );

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /Focus now/ }));

    expect(
      screen.queryByRole('button', { name: 'Delete goal' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Focus now')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        category: 'now',
        afterGoalId: 'goal-now-custom',
        title: 'New focus',
      });
    });

    const titleInput = screen.getByLabelText('Rename card');
    fireEvent.change(titleInput, { target: { value: 'Updated focus' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(updateGoalTitleMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        goalId: 'goal-now-custom',
        title: 'Updated focus',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete goal' }));
    expect(
      await screen.findByText('This goal has content. Delete it anyway?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        goalId: 'goal-now-custom',
      });
    });
  });
});
