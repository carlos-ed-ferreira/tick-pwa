import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';

const scope = {
  id: 'guest:test',
  kind: 'guest' as const,
  ownerId: 'test',
};

const {
  assignGoalCategoryMock,
  createCategoryTagMock,
  createGoalMock,
  createGoalStepMock,
  mergeGoalsInCategoryTagMock,
  reorderGoalStepMock,
  requestSyncMock,
  softDeleteGoalStepMock,
  updateCategoryTagMock,
  updateGoalStepTextMock,
  useCategoryTagsMock,
  useGoalsMock,
  useGoalStepTreeMock,
} = vi.hoisted(() => ({
  assignGoalCategoryMock: vi.fn().mockResolvedValue(undefined),
  createCategoryTagMock: vi.fn(),
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  mergeGoalsInCategoryTagMock: vi.fn().mockResolvedValue(null),
  reorderGoalStepMock: vi.fn().mockResolvedValue(undefined),
  requestSyncMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStepMock: vi.fn().mockResolvedValue(undefined),
  updateCategoryTagMock: vi.fn().mockResolvedValue(undefined),
  updateGoalStepTextMock: vi.fn().mockResolvedValue(undefined),
  useCategoryTagsMock: vi.fn(),
  useGoalsMock: vi.fn(),
  useGoalStepTreeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  assignGoalCategory: assignGoalCategoryMock,
  assignGoalStepCategory: vi.fn().mockResolvedValue(undefined),
  createCategoryTag: createCategoryTagMock,
  createGoal: createGoalMock,
  createGoalStep: createGoalStepMock,
  createGoalStepChild: vi.fn().mockResolvedValue(undefined),
  indentGoalStep: vi.fn().mockResolvedValue(undefined),
  mergeGoalsInCategoryTag: mergeGoalsInCategoryTagMock,
  outdentGoalStep: vi.fn().mockResolvedValue(undefined),
  reorderGoalStep: reorderGoalStepMock,
  softDeleteGoalStep: softDeleteGoalStepMock,
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: vi.fn().mockResolvedValue(undefined),
  updateCategoryTag: updateCategoryTagMock,
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
        groupsDescription: 'Organize goals into groups.',
        groupDetailDescription: 'Track and edit this group.',
        newGroupCard: 'New group',
        createGoalGroup: 'Create a new goal group',
        newGroupName: 'New group',
        backToGoalGroups: 'Back to goal groups',
        newGoalTitle: 'New goal',
        goalTitlePlaceholder: 'Goal name',
        renameGoal: 'Rename goal',
        addGoal: 'Add goal',
        addGoalAfter: 'Add goal below',
        addStep: 'Add item',
        emptyGroup: 'This group has no goals yet. Create the first goal.',
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
    scope,
    requestSync: requestSyncMock,
  }),
}));

vi.mock('@/features/categories', () => ({
  CategoryAssignmentMenu: () => null,
  useCategoryTags: useCategoryTagsMock,
}));

vi.mock('@/features/goals/use-goals', () => ({
  useGoals: useGoalsMock,
}));

vi.mock('@/features/goals/use-goal-step-tree', () => ({
  useGoalStepTree: useGoalStepTreeMock,
}));

const goalGroups = [
  {
    id: 'category-1',
    name: 'HOME',
    colorHex: '#71717a',
  },
  {
    id: 'category-2',
    name: 'WORK',
    colorHex: '#f0c38e',
  },
];

function goal(overrides: Record<string, unknown>) {
  return {
    id: 'goal-1',
    title: 'Goal A',
    category: 'now',
    categoryTagId: 'category-1',
    ...overrides,
  };
}

function goalStep(overrides: Record<string, unknown> = {}) {
  return {
    goalStep: {
      id: 'goal-step-1',
      goalId: 'goal-1',
      parentId: null,
      text: 'Existing step',
      completed: false,
      collapsed: false,
      categoryTagId: null,
      sortRank: 'U',
      ...overrides,
    },
    depth: 0,
    childCount: 0,
    hasChildren: false,
    isFirstSibling: false,
    isLastSibling: false,
  };
}

describe('GoalsSurface', () => {
  beforeEach(() => {
    assignGoalCategoryMock.mockClear();
    createCategoryTagMock.mockReset();
    createCategoryTagMock.mockResolvedValue({
      id: 'category-new',
      name: 'NEW GROUP',
      colorHex: '#f0c38e',
    });
    createGoalMock.mockReset();
    createGoalMock.mockResolvedValue({ id: 'goal-new' });
    createGoalStepMock.mockReset();
    createGoalStepMock.mockResolvedValue(undefined);
    mergeGoalsInCategoryTagMock.mockClear();
    reorderGoalStepMock.mockClear();
    requestSyncMock.mockClear();
    softDeleteGoalStepMock.mockClear();
    updateCategoryTagMock.mockClear();
    updateGoalStepTextMock.mockClear();
    useCategoryTagsMock.mockReset();
    useCategoryTagsMock.mockReturnValue(goalGroups);
    useGoalsMock.mockReset();
    useGoalsMock.mockImplementation((_scope, category) =>
      category === 'now' ? [goal({})] : [],
    );
    useGoalStepTreeMock.mockReset();
    useGoalStepTreeMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders editable goal group cards before loading goals', () => {
    render(<GoalsSurface />);

    expect(screen.getByRole('button', { name: 'HOME' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WORK' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create a new goal group' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Horizons')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Focus now' })).toBeNull();
    expect(screen.queryByDisplayValue('Goal A')).not.toBeInTheDocument();
  });

  it('creates a new goal group from the dashed add card', async () => {
    render(<GoalsSurface />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Create a new goal group' }),
    );

    await waitFor(() => {
      expect(createCategoryTagMock).toHaveBeenCalledWith({
        scope,
        surface: 'goals',
        name: 'New group',
        colorHex: '#f0c38e',
      });
    });
    expect(requestSyncMock).toHaveBeenCalled();
  });

  it('opens a group and renders one checklist for the selected group', () => {
    useGoalsMock.mockImplementation((_scope, category) =>
      category === 'now'
        ? [
            goal({
              id: 'goal-1',
              title: 'Home goal',
              categoryTagId: 'category-1',
            }),
            goal({
              id: 'goal-2',
              title: 'Work goal',
              categoryTagId: 'category-2',
            }),
          ]
        : [],
    );
    useGoalStepTreeMock.mockImplementation((_scope, goalId) =>
      goalId === 'goal-1' ? [goalStep()] : [],
    );

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));

    expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Home goal')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Work goal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add goal' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Back to goal groups' }),
    ).toBeInTheDocument();
  });

  it('creates the first backing goal and checklist item from an empty group', async () => {
    useGoalsMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'WORK' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this section with a checklist item',
      }),
    );

    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith({
        scope,
        category: 'now',
        title: 'WORK',
      });
    });
    expect(assignGoalCategoryMock).toHaveBeenCalledWith({
      scope,
      goalId: 'goal-new',
      categoryTagId: 'category-2',
    });
    expect(createGoalStepMock).toHaveBeenCalledWith({
      scope,
      goalId: 'goal-new',
    });
  });

  it('creates the first checklist item inside an existing grouped goal', async () => {
    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this section with a checklist item',
      }),
    );

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
      });
    });
    expect(createGoalMock).not.toHaveBeenCalled();
  });

  it('reorders a goal step when clicking the move controls', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));
    fireEvent.click(screen.getByLabelText('Move item up'));

    await waitFor(() => {
      expect(reorderGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
        direction: 'up',
      });
    });
  });

  it('flushes edited goal step text before creating a sibling with Enter', async () => {
    createGoalStepMock.mockResolvedValue({ id: 'new-goal-step' });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));

    const input = screen.getByDisplayValue('Existing step');
    fireEvent.change(input, { target: { value: 'Edited step' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        parentId: null,
        afterGoalStepId: 'goal-step-1',
      });
    });
    expect(updateGoalStepTextMock).toHaveBeenCalledWith({
      scope,
      goalStepId: 'goal-step-1',
      text: 'Edited step',
    });
    expect(updateGoalStepTextMock.mock.invocationCallOrder[0]).toBeLessThan(
      createGoalStepMock.mock.invocationCallOrder[0],
    );
  });

  it('bulk deletes a selected goal step from selection mode', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));

    fireEvent.click(screen.getByLabelText('Select item'));
    fireEvent.click(screen.getByLabelText('Delete item'));

    expect(
      await screen.findByText('This will delete 1 items. Continue?'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
      });
    });
  });

  it('renames the goal group on blur of the title input', async () => {
    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));

    const nameInput = screen.getByRole('textbox', { name: 'Rename goal' });
    fireEvent.change(nameInput, { target: { value: 'CASA' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(updateCategoryTagMock).toHaveBeenCalledWith({
        scope,
        categoryTagId: 'category-1',
        name: 'CASA',
      });
    });
    expect(requestSyncMock).toHaveBeenCalled();
  });

  it('merges duplicate goals inside the same group instead of showing subdivisions', async () => {
    useGoalsMock.mockImplementation((_scope, category) =>
      category === 'now'
        ? [
            goal({
              id: 'goal-1',
              title: 'Home goal',
              categoryTagId: 'category-1',
            }),
            goal({
              id: 'goal-2',
              title: 'Side project',
              categoryTagId: 'category-1',
            }),
          ]
        : [],
    );

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));

    await waitFor(() => {
      expect(mergeGoalsInCategoryTagMock).toHaveBeenCalledWith({
        scope,
        categoryTagId: 'category-1',
      });
    });
    expect(screen.queryByDisplayValue('Home goal')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Side project')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete goal' })).toBeNull();
  });
});
