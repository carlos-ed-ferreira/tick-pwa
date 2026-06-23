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
  completeGoalMock,
  createGoalMock,
  createGoalStepMock,
  moveGoalToGroupMock,
  reopenGoalMock,
  routerPushMock,
  useCategoryTagsMock,
  useGoalGroupsMock,
  useGoalsMock,
  useGoalStepSummariesMock,
  useGoalStepTreeMock,
} = vi.hoisted(() => ({
  completeGoalMock: vi.fn().mockResolvedValue(undefined),
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  moveGoalToGroupMock: vi.fn().mockResolvedValue(undefined),
  reopenGoalMock: vi.fn().mockResolvedValue(undefined),
  routerPushMock: vi.fn(),
  useCategoryTagsMock: vi.fn(),
  useGoalGroupsMock: vi.fn(),
  useGoalsMock: vi.fn(),
  useGoalStepSummariesMock: vi.fn(),
  useGoalStepTreeMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock('@/lib/db', () => ({
  assignGoalCategory: vi.fn().mockResolvedValue(undefined),
  assignGoalGroupCategory: vi.fn().mockResolvedValue(undefined),
  assignGoalStepCategory: vi.fn().mockResolvedValue(undefined),
  completeGoal: completeGoalMock,
  createGoal: createGoalMock,
  createGoalStep: createGoalStepMock,
  createGoalStepChild: vi.fn().mockResolvedValue({ id: 'child' }),
  groupGoalsTogether: vi.fn().mockResolvedValue({ id: 'group-new' }),
  indentGoalStep: vi.fn().mockResolvedValue(undefined),
  moveGoalToGroup: moveGoalToGroupMock,
  outdentGoalStep: vi.fn().mockResolvedValue(undefined),
  reopenGoal: reopenGoalMock,
  reorderGoal: vi.fn().mockResolvedValue(undefined),
  reorderGoalGroup: vi.fn().mockResolvedValue(undefined),
  reorderGoalStep: vi.fn().mockResolvedValue(undefined),
  softDeleteGoal: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStep: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepPriority: vi.fn().mockResolvedValue(undefined),
  updateGoalGroupTitle: vi.fn().mockResolvedValue(undefined),
  updateGoalStepText: vi.fn().mockResolvedValue(undefined),
  updateGoalTitle: vi.fn().mockResolvedValue(undefined),
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
        confirmDeleteItem: 'Are you sure?',
        selectItem: 'Select item',
        deselectItem: 'Deselect item',
        itemsSelected: '{count} selected',
        bulkDeleteItems: 'Delete selected',
        confirmBulkDeleteItems: 'Are you sure?',
        clearSelection: 'Clear selection',
        saveFailed: 'Save failed',
      },
      goals: {
        activeGoals: 'Active',
        archivedGoals: 'Archived',
        assignGoalCategory: 'Assign goal category',
        assignGroupCategory: 'Assign group category',
        backToGoalGroups: 'Back to goal groups',
        completeGoal: 'Complete goal',
        confirmDeleteGoal: 'Delete this goal?',
        deleteGoal: 'Delete goal',
        dragGoal: 'Drag goal',
        emptyGoal: 'Start this goal with a checklist item',
        goalMenu: 'Goal actions',
        goalTitlePlaceholder: 'Goal name',
        groupCategories: 'Groups',
        groupTitlePlaceholder: 'Group name',
        moveTo: 'Move to...',
        newGoalTitle: 'New goal',
        newGroupName: 'New group',
        noGroup: 'No group',
        originGroup: 'Original group',
        renameGoal: 'Rename goal',
        renameGroup: 'Rename group',
        restoreGoal: 'Restore goal',
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

vi.mock('@/features/goals/use-goal-groups', () => ({
  useGoalGroups: useGoalGroupsMock,
}));

vi.mock('@/features/goals/use-goal-step-summaries', () => ({
  getGoalStepSummary: (
    summaries: Map<string, unknown>,
    goalId: string,
  ): unknown =>
    summaries.get(goalId) ?? {
      completedCount: 0,
      itemCount: 0,
      categoryTagIds: [],
      categorySummaries: new Map(),
    },
  useGoalStepSummaries: useGoalStepSummariesMock,
}));

vi.mock('@/features/goals/use-goal-step-tree', () => ({
  useGoalStepTree: useGoalStepTreeMock,
}));

function goal(overrides: Record<string, unknown>) {
  return {
    id: 'goal-1',
    groupId: null,
    title: 'Focus',
    categoryTagId: null,
    completedAt: null,
    ...overrides,
  };
}

function group(overrides: Record<string, unknown>) {
  return {
    id: 'group-1',
    title: 'Life',
    categoryTagId: null,
    sortRank: 'U',
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
      priority: false,
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
    window.history.replaceState({}, '', '/goals');
    createGoalMock.mockReset();
    createGoalMock.mockResolvedValue({ id: 'goal-new' });
    createGoalStepMock.mockReset();
    createGoalStepMock.mockResolvedValue({ id: 'step-new' });
    completeGoalMock.mockClear();
    moveGoalToGroupMock.mockClear();
    reopenGoalMock.mockClear();
    routerPushMock.mockClear();
    useCategoryTagsMock.mockReturnValue([]);
    useGoalGroupsMock.mockReturnValue([]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [goal({ id: 'goal-1', title: 'Focus' })];
    });
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 2,
            itemCount: 3,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );
    useGoalStepTreeMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders active goals with a New goal action and no New group action', () => {
    render(<GoalsSurface />);

    expect(
      screen.getByRole('button', { name: 'New goal' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /new group/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('creates a real ungrouped goal from the primary action', async () => {
    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'New goal' }));

    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith({
        scope,
        groupId: null,
        title: 'New goal',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-new');
  });

  it('renders groups as main cards with compact goal tiles', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' }),
        goal({ id: 'goal-2', title: 'Work', groupId: 'group-1' }),
      ];
    });

    render(<GoalsSurface />);

    expect(
      screen.getByRole('button', { name: /LifeHealthWork/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.queryByText('2/3')).not.toBeInTheDocument();
  });

  it('opens a group and then opens a goal inside that group', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));
    expect(routerPushMock).toHaveBeenCalledWith('/goals?group=group-1');

    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-1');
  });

  it('opens a goal detail preserving the checklist item surface', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-1');
    expect(screen.getByLabelText('Rename goal')).toHaveValue('Focus');
    expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
  });

  it('shows archived goals and restores them', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [
          goal({
            id: 'goal-archived',
            title: 'Done',
            completedAt: '2026-06-23T12:00:00.000Z',
          }),
        ];
      }

      return [];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore goal' }));

    await waitFor(() => {
      expect(reopenGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
  });
});
