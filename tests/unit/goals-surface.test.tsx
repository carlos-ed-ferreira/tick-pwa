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
  createGoalMock,
  createGoalStepMock,
  reorderGoalStepMock,
  softDeleteGoalMock,
  softDeleteGoalStepMock,
  updateGoalTitleMock,
  updateGoalStepTextMock,
  routerPushMock,
  useCategoryTagsMock,
  useGoalsMock,
  useGoalStepTreeMock,
} = vi.hoisted(() => ({
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  reorderGoalStepMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStepMock: vi.fn().mockResolvedValue(undefined),
  updateGoalTitleMock: vi.fn().mockResolvedValue(undefined),
  updateGoalStepTextMock: vi.fn().mockResolvedValue(undefined),
  routerPushMock: vi.fn(),
  useCategoryTagsMock: vi.fn(),
  useGoalsMock: vi.fn(),
  useGoalStepTreeMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock('@/lib/db', () => ({
  assignGoalStepCategory: vi.fn().mockResolvedValue(undefined),
  createGoal: createGoalMock,
  createGoalStep: createGoalStepMock,
  createGoalStepChild: vi.fn().mockResolvedValue(undefined),
  indentGoalStep: vi.fn().mockResolvedValue(undefined),
  outdentGoalStep: vi.fn().mockResolvedValue(undefined),
  reorderGoalStep: reorderGoalStepMock,
  softDeleteGoal: softDeleteGoalMock,
  softDeleteGoalStep: softDeleteGoalStepMock,
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepPriority: vi.fn().mockResolvedValue(undefined),
  updateGoalStepText: updateGoalStepTextMock,
  updateGoalTitle: updateGoalTitleMock,
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
        confirmDeleteItem: 'Are you sure you want to delete this item?',
        selectItem: 'Select item',
        deselectItem: 'Deselect item',
        itemsSelected: '{count} selected',
        bulkDeleteItems: 'Delete selected',
        confirmBulkDeleteItems: 'Are you sure you want to delete this item?',
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
        confirmDeleteGoal: 'Are you sure you want to delete this item?',
        progress: 'Progress',
        title: 'Goals',
      },
      actions: {
        cancel: 'Cancel',
        delete: 'Delete',
      },
    },
    scope,
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

function goal(overrides: Record<string, unknown>) {
  return {
    id: 'goal-1',
    title: 'Focus',
    category: 'now',
    categoryTagId: null,
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
    createGoalMock.mockReset();
    createGoalMock.mockResolvedValue({ id: 'goal-new' });
    createGoalStepMock.mockReset();
    createGoalStepMock.mockResolvedValue(undefined);
    reorderGoalStepMock.mockClear();
    softDeleteGoalMock.mockClear();
    softDeleteGoalStepMock.mockClear();
    routerPushMock.mockClear();
    updateGoalTitleMock.mockClear();
    updateGoalStepTextMock.mockClear();
    useCategoryTagsMock.mockReset();
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-1',
        name: 'HOME',
        colorHex: '#71717a',
      },
    ]);
    useGoalsMock.mockReset();
    useGoalsMock.mockImplementation((_scope, category) => {
      if (category === 'short') {
        return [];
      }

      if (category === 'medium') {
        return [];
      }

      if (category === 'long') {
        return [];
      }

      return [goal({ id: 'goal-1', title: 'Focus' })];
    });
    useGoalStepTreeMock.mockReset();
    useGoalStepTreeMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders goal cards and a new goal card without showing categories as groups', () => {
    render(<GoalsSurface />);

    expect(
      screen.queryByRole('heading', { name: 'Goals' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create a new goal group' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('creates a new goal card from the dashed add card', async () => {
    render(<GoalsSurface />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Create a new goal group' }),
    );

    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith({
        scope,
        category: 'now',
        title: 'NEW GROUP',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-new');
  });

  it('opens a goal as an independent browser history entry and renders one checklist card for it', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-1');
    expect(screen.getByLabelText('Rename goal')).toHaveValue('Focus');
    expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Back to goal groups' }),
    ).toHaveClass('shrink-0');
    expect(screen.queryByRole('button', { name: 'Add goal' })).toBeNull();
    expect(
      screen.getByText('Focus', { selector: 'span[aria-hidden="true"]' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Focus', { selector: 'span[aria-hidden="true"]' })
        .parentElement,
    ).toHaveClass('shrink', 'overflow-hidden');
    expect(screen.getByLabelText('Rename goal')).toHaveAttribute('size', '1');
  });

  it('creates the first checklist item from the empty state', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
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
  });

  it('reorders a goal step when clicking the move controls', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByDisplayValue('Existing step');
    fireEvent.change(input, { target: { value: 'Edited step' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        id: expect.any(String),
        parentId: null,
        afterGoalStepId: 'goal-step-1',
      });
    });
    expect(updateGoalStepTextMock).toHaveBeenCalledWith({
      scope,
      goalStepId: 'goal-step-1',
      text: 'Edited step',
    });
  });

  it('bulk deletes a selected goal step from selection mode', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    fireEvent.click(screen.getByLabelText('Select item'));
    fireEvent.click(screen.getByLabelText('Delete item'));

    expect(
      await screen.findByText('Are you sure you want to delete this item?'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
      });
    });
  });

  it('renames and deletes a goal card', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const titleInput = screen.getByLabelText('Rename goal');
    fireEvent.change(titleInput, { target: { value: 'Updated goal' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(updateGoalTitleMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        title: 'UPDATED GOAL',
      });
    });

    fireEvent.change(titleInput, { target: { value: '' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(updateGoalTitleMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText('Rename goal')).toHaveDisplayValue('Focus');

    fireEvent.click(screen.getByRole('button', { name: 'Delete goal' }));
    expect(
      await screen.findByText('Are you sure you want to delete this item?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
      });
    });
    expect(routerPushMock).toHaveBeenLastCalledWith('/goals');
  });
});
