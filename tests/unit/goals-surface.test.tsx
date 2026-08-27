import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';
import { db } from '@/lib/db/database';
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';
import { simulateClippedText } from '../support/truncation';

const scope = {
  id: 'guest:test',
  kind: 'guest' as const,
  ownerId: 'test',
};

const {
  assignGoalCategoryMock,
  assignGoalGroupCategoryMock,
  assignGoalStepCategoryMock,
  completeGoalMock,
  createCategoryTagMock,
  createGoalMock,
  createGoalStepMock,
  groupGoalsTogetherMock,
  moveGoalToGroupMock,
  reopenGoalMock,
  routerPushMock,
  setGoalStepsCompletedMock,
  softDeleteGoalMock,
  softDeleteGoalStepMock,
  softDeleteGoalGroupMock,
  toggleGoalStepCollapsedMock,
  updateCategoryTagMock,
  updateGoalDueDateMock,
  updateGoalStepScheduledDateMock,
  updateGoalStepTextMock,
  updateGoalTitleMock,
  useCategoryTagsMock,
  useGoalGroupsMock,
  useGoalsMock,
  useGoalStepSummariesMock,
  useGoalStepTreeMock,
} = vi.hoisted(() => ({
  assignGoalCategoryMock: vi.fn().mockResolvedValue(undefined),
  assignGoalGroupCategoryMock: vi.fn().mockResolvedValue(undefined),
  assignGoalStepCategoryMock: vi.fn().mockResolvedValue(undefined),
  completeGoalMock: vi.fn().mockResolvedValue(undefined),
  createCategoryTagMock: vi.fn(),
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  groupGoalsTogetherMock: vi.fn().mockResolvedValue({ id: 'group-new' }),
  moveGoalToGroupMock: vi.fn().mockResolvedValue(undefined),
  reopenGoalMock: vi.fn().mockResolvedValue(undefined),
  routerPushMock: vi.fn(),
  setGoalStepsCompletedMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStepMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalGroupMock: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsedMock: vi.fn().mockResolvedValue(undefined),
  updateCategoryTagMock: vi.fn().mockResolvedValue(undefined),
  updateGoalDueDateMock: vi.fn().mockResolvedValue(undefined),
  updateGoalStepScheduledDateMock: vi.fn().mockResolvedValue(undefined),
  updateGoalStepTextMock: vi.fn().mockResolvedValue(undefined),
  updateGoalTitleMock: vi.fn().mockResolvedValue(undefined),
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
  assignGoalCategory: assignGoalCategoryMock,
  assignGoalGroupCategory: assignGoalGroupCategoryMock,
  assignGoalStepCategory: assignGoalStepCategoryMock,
  completeGoal: completeGoalMock,
  createCategoryTag: createCategoryTagMock,
  createGoal: createGoalMock,
  createGoalStep: createGoalStepMock,
  createGoalStepChild: vi.fn().mockResolvedValue({ id: 'child' }),
  groupGoalsTogether: groupGoalsTogetherMock,
  indentGoalStep: vi.fn().mockResolvedValue(undefined),
  moveGoalAfter: vi.fn().mockResolvedValue(undefined),
  moveGoalBefore: vi.fn().mockResolvedValue(undefined),
  moveGoalGroupAfter: vi.fn().mockResolvedValue(undefined),
  moveGoalGroupBefore: vi.fn().mockResolvedValue(undefined),
  moveGoalToGroup: moveGoalToGroupMock,
  outdentGoalStep: vi.fn().mockResolvedValue(undefined),
  reopenGoal: reopenGoalMock,
  reorderGoal: vi.fn().mockResolvedValue(undefined),
  reorderGoalGroup: vi.fn().mockResolvedValue(undefined),
  reorderGoalStep: vi.fn().mockResolvedValue(undefined),
  setGoalStepsCompleted: setGoalStepsCompletedMock,
  softDeleteGoal: softDeleteGoalMock,
  softDeleteGoalGroup: softDeleteGoalGroupMock,
  softDeleteGoalStep: softDeleteGoalStepMock,
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: toggleGoalStepCollapsedMock,
  toggleGoalStepPriority: vi.fn().mockResolvedValue(undefined),
  updateCategoryTag: updateCategoryTagMock,
  updateGoalDueDate: updateGoalDueDateMock,
  updateGoalGroupTitle: vi.fn().mockResolvedValue(undefined),
  updateGoalStepScheduledDate: updateGoalStepScheduledDateMock,
  updateGoalStepText: updateGoalStepTextMock,
  updateGoalTitle: updateGoalTitleMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      calendar: {
        clearDate: 'Clear date',
        nextMonth: 'Next month',
        openDatePicker: 'Open date picker for {label}',
        previousMonth: 'Previous month',
        selectDate: 'Select date',
        today: 'Today',
        weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      goalStepEditor: {
        itemDate: 'Step date',
        expandItem: 'Expand step',
        collapseItem: 'Collapse step',
        toggleItem: 'Change step status',
        itemPlaceholder: 'Write a step',
        addChild: 'Create substep',
        indentItem: 'Make substep',
        moveItemDown: 'Move step down',
        moveItemUp: 'Move step up',
        moreActions: 'More actions',
        outdentItem: 'Promote step one level',
        markPriority: 'Mark as priority',
        unmarkPriority: 'Remove priority',
        makeTextBold: 'Make text bold',
        makeTextNormal: 'Make text normal',
        deleteItem: 'Delete step',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        confirmDeleteItem: 'Are you sure?',
        selectItem: 'Select step',
        deselectItem: 'Deselect step',
        itemSelected: '{count} step selected',
        itemsSelected: '{count} steps selected',
        bulkDeleteItems: 'Delete selected steps',
        confirmBulkDeleteItem:
          'You are about to delete {count} selected record.',
        confirmBulkDeleteItems:
          'You are about to delete {count} selected records.',
        clearSelection: 'Clear selection',
        bulkPriority: 'Priority',
        bulkBold: 'Bold',
        bulkCategory: 'Category',
        bulkDelete: 'Delete',
        bulkMark: 'Mark',
        actionHidden: 'Hidden',
        actionInMenu: 'Three-dot menu',
        actionOnRow: 'On row',
        actionVisible: 'Visible',
        configurePreferences: 'Configure step actions',
        dragAndDrop: 'Drag and drop',
        preferencesTitle: 'Step actions',
        resetPreferences: 'Restore defaults',
      },
      goals: {
        activeGoals: 'Active',
        viewMode: 'Step view',
        viewModeList: 'Single list',
        viewModeTabs: 'Category tabs',
        categoryTabs: 'Step categories',
        categoryTabAll: 'All',
        categoryTabUncategorized: 'No category',
        archivedGoals: 'Archived',
        addStep: 'Add step',
        assignGoalCategory: 'Assign goal category',
        assignGoalCategoryMenu: 'Assign category',
        assignGoalColor: 'Assign independent color',
        clearGoalCategory: 'Clear goal color/category',
        dueDateLabel: 'Goal date',
        assignGoalDueDate: 'Select goal date',
        assignGroupCategory: 'Assign group category',
        assignGroupCategoryMenu: 'Assign category',
        assignGroupColor: 'Assign independent color',
        backToGoalGroups: 'Back to goal groups',
        completeGoal: 'Archive goal',
        confirmCompleteGoal: 'Archive this goal?',
        confirmDeleteGoal: 'Delete this goal?',
        deleteGoal: 'Delete goal',
        dragGoal: 'Drag goal',
        emptyGoal: 'Start this goal by adding a step',
        goalMenu: 'Goal actions',
        groupMenu: 'Group actions',
        goalTitlePlaceholder: 'Goal name',
        groupCategories: 'Groups',
        groupTitlePlaceholder: 'Group name',
        createGroupTitle: 'Create group',
        createGroupDescription: 'Choose the initial name for this group.',
        createGroupConfirm: 'Create group',
        moveTo: 'Move goal to group:',
        newGoalTitle: 'New goal',
        newGroupName: 'New group',
        removeFromGroup: 'Remove from group',
        clearGroupCategory: 'Clear group color/category',
        deleteGroup: 'Delete group',
        confirmDeleteGroup: 'Delete this group?',
        emptyArchivedGoals: 'There are no archived goals.',
        noGroup: 'No group',
        originGroup: 'Original group',
        renameGoal: 'Rename goal',
        renameGroup: 'Rename group',
        confirmRestoreGoal: 'Restore this goal?',
        restoreGoal: 'Restore goal',
      },
      actions: {
        cancel: 'Cancel',
        delete: 'Delete',
      },
    },
    locale: 'en',
    scope,
    timezonePreference: {
      timezone: 'America/Sao_Paulo',
    },
  }),
}));

vi.mock('@/features/categories/use-category-tags', () => ({
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
    dueDate: null,
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
      scheduledDate: null,
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
  it('uses the requested pt-BR labels in the goal card menu', () => {
    expect(ptBRDictionary.goalStepEditor.itemSelected).toBe(
      '{count} etapa selecionada',
    );
    expect(ptBRDictionary.goalStepEditor.itemsSelected).toBe(
      '{count} etapas selecionadas',
    );
    expect(ptBRDictionary.goalStepEditor.confirmBulkDeleteItem).toBe(
      'Você está prestes a excluir {count} etapa selecionada.',
    );
    expect(ptBRDictionary.goalStepEditor.confirmBulkDeleteItems).toBe(
      'Você está prestes a excluir {count} etapas selecionadas.',
    );
    expect(ptBRDictionary.goals.assignGoalColor).toBe(
      'Atribuir cor independente',
    );
    expect(ptBRDictionary.goals.assignGoalCategoryMenu).toBe(
      'Atribuir categoria',
    );
    expect(ptBRDictionary.goals.clearGoalCategory).toBe(
      'Limpar cor/categoria da meta',
    );
    expect(ptBRDictionary.goals.moveTo).toBe('Mover meta para o grupo:');
  });

  beforeEach(() => {
    window.history.replaceState({}, '', '/goals');
    createGoalMock.mockReset();
    createGoalMock.mockResolvedValue({ id: 'goal-new' });
    createGoalStepMock.mockReset();
    createGoalStepMock.mockResolvedValue({ id: 'step-new' });
    completeGoalMock.mockClear();
    assignGoalGroupCategoryMock.mockClear();
    assignGoalStepCategoryMock.mockClear();
    groupGoalsTogetherMock.mockClear();
    moveGoalToGroupMock.mockClear();
    reopenGoalMock.mockClear();
    routerPushMock.mockClear();
    setGoalStepsCompletedMock.mockClear();
    softDeleteGoalStepMock.mockClear();
    softDeleteGoalMock.mockClear();
    softDeleteGoalGroupMock.mockClear();
    toggleGoalStepCollapsedMock.mockClear();
    updateGoalStepTextMock.mockClear();
    updateGoalTitleMock.mockClear();
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal') {
        return [
          {
            id: 'category-1',
            name: 'Modo local',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal',
          },
        ];
      }

      return [];
    });
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

    expect(screen.getAllByRole('button', { name: 'New goal' })).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /new group/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Archived' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Active' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveClass(
      'cursor-pointer',
    );
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveClass('p-4');
    expect(screen.getByLabelText('Drag goal')).toHaveClass(
      'size-7',
      'rounded-full',
      'hover:bg-[#f0c38e]/14',
    );
    expect(screen.getByLabelText('Drag goal')).not.toHaveClass(
      'hover:bg-background',
    );
    expect(screen.getByText('Focus')).toHaveClass('text-base');
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

  it('uses the same button pattern to enter and leave archived goals', () => {
    render(<GoalsSurface />);

    const archivedButton = screen.getByRole('button', { name: 'Archived' });

    expect(archivedButton).toHaveClass(
      'min-h-10',
      'w-fit',
      'rounded-full',
      'inset-ring-white/10',
      'bg-white/5',
      'px-4',
      'py-2',
      'text-sm',
      'font-semibold',
    );

    fireEvent.click(archivedButton);

    const activeButton = screen.getByRole('button', { name: 'Active' });

    expect(activeButton).toHaveClass(
      'min-h-10',
      'w-fit',
      'rounded-full',
      'inset-ring-white/10',
      'bg-white/5',
      'px-4',
      'py-2',
      'text-sm',
      'font-semibold',
    );
    expect(activeButton.querySelector('.lucide-target')).not.toBeNull();
  });

  it('groups archived goals in flat sections and omits origin from cards', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) =>
      surface === 'goal_group'
        ? [
            {
              id: 'category-personal',
              name: 'Personal',
              colorHex: '#8b5cf6',
              position: '1',
              surface: 'goal_group',
            },
          ]
        : [],
    );
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-life',
        title: 'Life',
        sortRank: 'A',
        categoryTagId: 'category-personal',
      }),
      group({ id: 'group-work', title: 'Work', sortRank: 'B' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (!options.archived) return [];

      return [
        goal({
          id: 'goal-health',
          title: 'Health',
          groupId: 'group-life',
          completedAt: '2026-06-20T12:00:00.000Z',
        }),
        goal({
          id: 'goal-family',
          title: 'Family',
          groupId: 'group-life',
          completedAt: '2026-06-21T12:00:00.000Z',
        }),
        goal({
          id: 'goal-career',
          title: 'Career',
          groupId: 'group-work',
          completedAt: '2026-06-22T12:00:00.000Z',
        }),
        goal({
          id: 'goal-loose',
          title: 'Loose',
          groupId: null,
          completedAt: '2026-06-23T12:00:00.000Z',
        }),
      ];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));

    const lifeSection = screen.getByTestId('archived-goal-group-group-life');
    const workSection = screen.getByTestId('archived-goal-group-group-work');
    const noGroupSection = screen.getByTestId('archived-goal-group-none');
    const activeButton = screen.getByRole('button', { name: 'Active' });

    expect(lifeSection).not.toHaveClass(
      'inset-ring-hairline',
      'bg-white/[0.035]',
    );
    expect(within(lifeSection).getByText('Life')).toBeVisible();
    expect(within(lifeSection).getByText('Personal')).toBeVisible();
    expect(
      within(lifeSection).getByRole('button', { name: 'Health' }),
    ).toBeVisible();
    expect(
      within(lifeSection).getByRole('button', { name: 'Family' }),
    ).toBeVisible();
    expect(
      within(lifeSection).getByRole('button', { name: 'Health' }).parentElement,
    ).toHaveClass('lg:grid-cols-3', 'xl:grid-cols-4');
    expect(
      within(workSection).getByRole('button', { name: 'Career' }),
    ).toBeVisible();
    expect(
      within(noGroupSection).getByRole('button', { name: 'Loose' }),
    ).toBeVisible();
    expect(screen.queryByText(/Original group:/)).not.toBeInTheDocument();
    expect(
      screen
        .getAllByTestId(/^archived-goal-group-/)
        .map((section) => within(section).getByRole('heading').textContent),
    ).toEqual(['Life', 'Work', 'No group']);
    expect(
      lifeSection.compareDocumentPosition(activeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('uses the standard dropdown and allows deleting an archived goal', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived
        ? [
            goal({
              id: 'goal-archived',
              title: 'Done',
              completedAt: '2026-06-23T12:00:00.000Z',
            }),
          ]
        : [],
    );

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const menu = document.querySelector('[data-goal-actions-menu="true"]');
    const deleteButton = screen.getByRole('button', { name: 'Delete goal' });

    expect(menu).toHaveClass('modal-panel', 'modal-panel--flat');
    expect(deleteButton).toHaveClass('min-h-10', 'w-full', 'gap-3', 'px-3');

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(softDeleteGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
  });

  it('renders archived goal steps as read-only content', () => {
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
    useGoalStepTreeMock.mockReturnValue([
      goalStep({
        goalId: 'goal-archived',
        text: 'Archived step',
        completed: true,
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText('Archived step')).toBeVisible();
    expect(screen.queryByDisplayValue('Archived step')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add step' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'More actions' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.queryByLabelText('Assign independent color'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign goal category' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear goal color/category' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore goal' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete goal' })).toBeVisible();
  });

  it('asks for the initial group name before combining two ungrouped goals', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({ id: 'goal-1', title: 'Focus' }),
        goal({ id: 'goal-2', title: 'Health' }),
      ];
    });

    render(<GoalsSurface />);

    const sourceGoal = screen.getByRole('button', { name: 'Focus' });
    const targetGoal = screen.getByRole('button', { name: 'Health' });
    const dragHandle = screen.getAllByLabelText('Drag goal')[0];
    const dragCard = dragHandle.closest('article');

    if (!dragCard) {
      throw new Error('Drag card not found');
    }

    dragCard.getBoundingClientRect = vi.fn(() => ({
      bottom: 120,
      height: 80,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }));

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetGoal),
    });

    fireEvent.pointerDown(dragHandle, {
      button: 0,
      clientX: 40,
      clientY: 60,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 120,
      clientY: 80,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, {
      clientX: 120,
      clientY: 80,
      pointerId: 1,
    });

    expect(
      screen.getByRole('dialog', { name: 'Create group' }),
    ).toBeInTheDocument();

    const input = screen.getByLabelText('Group name');

    expect(input).toHaveValue('NEW GROUP');

    input.focus();
    fireEvent.change(input, { target: { value: 'Health plan' } });

    expect(input).toHaveValue('HEALTH PLAN');
    expect(input).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() => {
      expect(groupGoalsTogetherMock).toHaveBeenCalledWith({
        scope,
        sourceGoalId: 'goal-1',
        targetGoalId: 'goal-2',
        title: 'HEALTH PLAN',
      });
    });

    expect(
      screen.queryByRole('dialog', { name: 'Create group' }),
    ).not.toBeInTheDocument();
    expect(sourceGoal).toBeInTheDocument();
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

    const groupCard = screen.getByRole('button', { name: /LifeHealthWork/ });

    expect(groupCard).toBeInTheDocument();
    expect(groupCard).toHaveClass('h-32', 'pt-3.5', 'pb-5', 'gap-2');
    expect(screen.getByLabelText('Drag goal')).toHaveClass(
      'size-7',
      'rounded-full',
      'hover:bg-[#f0c38e]/14',
    );
    expect(screen.getByLabelText('Drag goal')).not.toHaveClass(
      'hover:bg-background',
    );
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Health').parentElement).toHaveClass(
      'px-4',
      'leading-tight',
    );
    expect(screen.queryByText('2/3')).not.toBeInTheDocument();
  });

  it('keeps goal and group cards borderless at rest and draws the hover edge as a hairline', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' }),
        goal({ id: 'goal-2', title: 'Work' }),
      ];
    });

    render(<GoalsSurface />);

    const groupCard = screen.getByRole('button', { name: /LifeHealth/ });
    const goalCard = screen.getByRole('button', { name: 'Work' });

    for (const card of [groupCard, goalCard]) {
      expect(card).not.toHaveClass('ring-1');
      expect(card).toHaveClass(
        'inset-ring-hairline',
        'inset-ring-transparent',
        'hover:inset-ring-[#f0c38e]/25',
      );
    }
  });

  it('renders the goal step surface without a border around the container', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health' })];
    });

    const { container } = render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));

    const stepSurface = container.querySelector('section[aria-label="Health"]');

    expect(stepSurface).toBeInTheDocument();
    expect(stepSurface).not.toHaveClass('ring-1');
    expect(stepSurface).toHaveClass('rounded-[0.75rem]', 'bg-white/[0.035]');
  });

  it('opens group actions from a three-dot button without opening the group card', async () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal_group') {
        return [
          {
            id: 'group-category',
            name: 'Personal',
            colorHex: '#8b5cf6',
            position: '1',
            surface: 'goal_group',
          },
        ];
      }

      return [];
    });
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
      }),
    ]);

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Group actions' }));

    expect(routerPushMock).not.toHaveBeenCalled();
    expect(
      screen
        .getByLabelText('Assign independent color')
        .closest('[data-card-actions-menu="true"]'),
    ).toHaveClass('modal-panel--flat');
    expect(screen.getByLabelText('Assign independent color')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Assign category' }),
    ).toBeVisible();
    expect(
      screen
        .getByRole('button', { name: 'Assign category' })
        .querySelector('.lucide-tag'),
    ).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear group color/category',
    });
    expect(clearCategoryButton).toBeVisible();
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete group' })).toHaveClass(
      'text-rose-300',
    );

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete group' }),
      ).not.toBeInTheDocument();
    });
  });

  it('shows a named goal category in its color to the right of the goal title', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          categoryTagId: 'category-1',
        }),
      ];
    });

    render(<GoalsSurface />);

    const title = screen.getByText('Focus');
    const categoryName = screen.getByText('Modo local');

    expect(title.compareDocumentPosition(categoryName)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(categoryName).toHaveStyle({ color: '#f97316' });
    expect(categoryName).toHaveClass('truncate', 'text-xs', 'font-semibold');
  });

  it('shows the complete goal card name in the project tooltip', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({
          id: 'goal-1',
          title: 'A goal name that needs truncation',
          categoryTagId: null,
        }),
      ];
    });

    render(<GoalsSurface />);

    const title = screen.getByText('A goal name that needs truncation');
    const header = title.parentElement?.parentElement;
    const menu = screen.getByRole('button', { name: 'Goal actions' });

    expect(title).toHaveClass('truncate');
    expect(header).toHaveClass('flex', 'items-center');
    expect(menu.parentElement?.parentElement).toBe(header);
    simulateClippedText(title);
    fireEvent.mouseEnter(title.parentElement!);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'A goal name that needs truncation',
    );
  });

  it('renders the group category badge with the shared system badge pattern', () => {
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-1',
        name: 'Modo local',
        colorHex: '#f97316',
        position: '1',
        surface: 'goals',
      },
    ]);
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
        categoryTagId: 'category-1',
      }),
    ]);

    render(<GoalsSurface />);

    const badge = screen.getByText('Modo local').parentElement;

    expect(badge).toHaveClass(
      'inline-flex',
      'min-h-7',
      'items-center',
      'gap-2',
      'rounded-full',
      'inset-ring-hairline',
      'px-3',
      'py-1',
      'text-[0.68rem]',
      'font-semibold',
      'uppercase',
      'tracking-[0.24em]',
      'text-[#f7e8ce]',
      'shadow-sm',
      'shadow-[#253241]/10',
    );
    expect(badge).toHaveStyle({
      '--chip-edge': 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });
  });

  it('keeps the plain group task dot between truncated content and the menu', async () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal_group') {
        return [
          {
            id: 'group-category',
            name: 'A category name that needs truncation',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal_group',
            useOwnName: false,
          },
        ];
      }

      return [];
    });
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'A group name that needs truncation',
        categoryTagId: 'group-category',
      }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', groupId: 'group-1' })];
    });
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 0,
            itemCount: 1,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    const indicator = screen.getByTestId('goal-group-task-indicator-group-1');
    const title = screen.getByText('A group name that needs truncation');
    const categoryName = screen.getByText(
      'A category name that needs truncation',
    );
    const menu = screen.getByRole('button', { name: 'Group actions' });
    const header = indicator.parentElement;

    expect(indicator).toHaveAttribute('data-status', 'pending');
    expect(header).toHaveClass('flex', 'items-center');
    expect(menu.parentElement?.parentElement).toBe(header);
    expect(indicator).toHaveClass('size-2.5', 'bg-[#f0c38e]');
    expect(indicator).not.toHaveClass(
      'shadow-[0_0_10px_rgba(240,195,142,0.55)]',
    );
    expect(indicator.querySelector('svg')).toBeNull();
    expect(categoryName).toHaveClass('truncate');
    expect(categoryName.compareDocumentPosition(indicator)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(indicator.compareDocumentPosition(menu)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    simulateClippedText(title);
    fireEvent.mouseEnter(title.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'A group name that needs truncation',
    );
  });

  it('uses a plain green dot when every active group task is complete', () => {
    useGoalGroupsMock.mockReturnValue([group({ id: 'group-1' })]);
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived ? [] : [goal({ id: 'goal-1', groupId: 'group-1' })],
    );
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 2,
            itemCount: 2,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    const indicator = screen.getByTestId('goal-group-task-indicator-group-1');

    expect(indicator).toHaveAttribute('data-status', 'complete');
    expect(indicator).toHaveClass('bg-emerald-400');
    expect(indicator.querySelector('svg')).toBeNull();
  });

  it('uses a plain muted dot when a group has no active tasks', () => {
    useGoalGroupsMock.mockReturnValue([group({ id: 'group-1' })]);
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived ? [] : [],
    );

    render(<GoalsSurface />);

    const indicator = screen.getByTestId('goal-group-task-indicator-group-1');

    expect(indicator).toHaveAttribute('data-status', 'empty');
    expect(indicator).toHaveClass('bg-[#66717f]');
    expect(indicator).not.toHaveClass('inset-ring-hairline');
  });

  it('wraps the group name in a color pill instead of showing a dot when useOwnName is true', () => {
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-1',
        name: '',
        colorHex: '#f97316',
        position: '1',
        surface: 'goals',
        useOwnName: true,
      },
    ]);
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
        categoryTagId: 'category-1',
      }),
    ]);

    const { container } = render(<GoalsSurface />);

    expect(screen.queryByText('Modo local')).not.toBeInTheDocument();

    const pill = screen.getByText('Life').parentElement;

    expect(pill).toHaveClass('rounded-full', 'inset-ring-hairline');
    expect(pill).toHaveStyle({
      '--chip-edge': 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });

    const dot = Array.from(container.querySelectorAll('span')).find(
      (element) =>
        element.className.includes('inset-ring-white/30') &&
        element.className.includes('rounded-full'),
    );

    expect(dot).toBeUndefined();
  });

  it('renders goal actions in a portal, shows remove from group for grouped goals, omits new group and closes on outside click', async () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Focus', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: /LifeFocus/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const completeButton = screen.getByRole('button', {
      name: 'Archive goal',
    });

    expect(
      completeButton.closest('[data-goal-actions-menu="true"]'),
    ).toHaveClass('modal-panel--flat');
    expect(completeButton.closest('article')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'New group' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'NOVO GRUPO' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'No group' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove from group' }),
    ).toHaveClass('hover:bg-white/[0.08]');

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Archive goal' }),
      ).not.toBeInTheDocument();
    });
  });

  it('opens goal categories to the right on hover and assigns a named category', async () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal') {
        return [
          {
            id: 'category-1',
            name: 'Modo local',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal',
          },
          {
            id: 'category-own',
            name: 'Cor independente',
            colorHex: '#2563eb',
            position: '2',
            surface: 'goal',
            useOwnName: true,
          },
        ];
      }

      if (surface === 'goalGroup') {
        return [
          {
            id: 'group-category',
            name: 'Categoria de grupo',
            colorHex: '#16a34a',
            position: '1',
            surface: 'goalGroup',
          },
        ];
      }

      return [];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const colorInput = screen.getByLabelText('Assign independent color');
    const categoryButton = screen.getByRole('button', {
      name: 'Assign category',
    });
    vi.spyOn(categoryButton, 'getBoundingClientRect').mockReturnValue({
      bottom: 140,
      height: 40,
      left: 100,
      right: 300,
      top: 100,
      width: 200,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    const actionsMenu = categoryButton.closest(
      '[data-goal-actions-menu="true"]',
    );
    vi.spyOn(actionsMenu!, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 280,
      left: 80,
      right: 308,
      top: 20,
      width: 228,
      x: 80,
      y: 20,
      toJSON: () => ({}),
    });

    expect(screen.queryByRole('button', { name: 'Modo local' })).toBeNull();
    expect(
      colorInput.closest('label')?.compareDocumentPosition(categoryButton),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.mouseEnter(categoryButton);

    const categoryOption = screen.getByRole('button', { name: 'Modo local' });
    const extension = categoryOption.closest('.modal-panel');

    expect(categoryOption).toBeVisible();
    expect(extension).toHaveClass(
      'dropdown-extension-panel',
      'rounded-l-none',
      'modal-panel--flat',
      'z-50',
    );
    expect(extension).not.toHaveClass('z-70');
    expect(actionsMenu).toHaveClass('dropdown-joined-main');
    expect(categoryOption).not.toHaveClass('bg-white/[0.06]');
    expect(extension).not.toHaveClass('-translate-y-1/2');
    expect(extension).toHaveStyle({
      left: '307px',
      top: '120px',
      transform: 'translateY(-50%)',
    });
    expect(screen.queryByText('Cor independente')).toBeNull();
    expect(screen.queryByText('Categoria de grupo')).toBeNull();

    fireEvent.click(categoryButton);
    expect(categoryOption).toBeVisible();

    fireEvent.mouseLeave(categoryButton, { relatedTarget: extension });
    expect(categoryOption).toBeVisible();

    fireEvent.mouseEnter(extension!, { relatedTarget: categoryButton });
    fireEvent.mouseLeave(extension!, { relatedTarget: document.body });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Modo local' })).toBeNull();
    });

    fireEvent.mouseEnter(categoryButton);
    fireEvent.click(screen.getByRole('button', { name: 'Modo local' }));

    await waitFor(() => {
      expect(assignGoalCategoryMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        categoryTagId: 'category-1',
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete goal' }),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the card menu open while choosing an own-name color and closes it when the color picker closes', async () => {
    createCategoryTagMock.mockResolvedValue({ id: 'category-own' });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const colorInput = screen.getByLabelText('Assign independent color');
    fireEvent.click(colorInput);

    fireEvent.input(colorInput, {
      target: { value: '#ff0000' },
    });

    await waitFor(() => {
      expect(createCategoryTagMock).toHaveBeenCalledWith({
        scope,
        surface: 'goal',
        name: '',
        colorHex: '#ff0000',
        useOwnName: true,
      });
      expect(assignGoalCategoryMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        categoryTagId: 'category-own',
      });
    });

    expect(screen.getByRole('button', { name: 'Delete goal' })).toBeVisible();

    fireEvent.change(colorInput);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete goal' }),
      ).not.toBeInTheDocument();
    });
  });

  it('clears the assigned category from a dedicated card menu action', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({ id: 'goal-1', title: 'Focus', categoryTagId: 'category-1' }),
      ];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    expect(
      screen
        .getByRole('button', { name: 'Assign category' })
        .querySelector('.lucide-tag'),
    ).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear goal color/category',
    });
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    fireEvent.click(clearCategoryButton);

    await waitFor(() => {
      expect(assignGoalCategoryMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        categoryTagId: null,
      });
    });
  });

  it('labels the group destination section as moving the goal to a group', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    expect(screen.getByText('Move goal to group:')).toBeVisible();
  });

  it('renders the delete action with a clearly visible red tone in the card menu', () => {
    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    expect(screen.getByRole('button', { name: 'Delete goal' })).toHaveClass(
      'text-rose-300',
    );
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

  it('renders the group detail header using the same input and back-button pattern as goal detail', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) =>
      surface === 'goal_group'
        ? [
            {
              id: 'group-category',
              name: 'Personal',
              colorHex: '#8b5cf6',
              position: '1',
              surface: 'goal_group',
            },
          ]
        : [],
    );
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
        categoryTagId: 'group-category',
      }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));

    const backButton = screen.getByRole('button', {
      name: 'Back to goal groups',
    });
    const titleInput = screen.getByLabelText('Rename group');
    const categoryButton = screen.getByRole('button', {
      name: 'Assign group category',
    });

    expect(backButton).toHaveClass(
      'min-h-10',
      'rounded-full',
      'inset-ring-hairline',
      'inset-ring-white/10',
      'bg-white/5',
      'px-4',
      'py-2',
    );
    expect(titleInput).toHaveValue('Life');
    expect(titleInput).not.toHaveAttribute('placeholder');
    expect(titleInput).toHaveClass(
      'absolute',
      'inset-0',
      'h-full',
      'w-full',
      'px-2',
      'py-1',
      'text-2xl',
      'font-semibold',
    );
    expect(titleInput.parentElement).toHaveClass(
      'relative',
      'inline-block',
      'min-w-0',
      'max-w-full',
      'shrink',
      'align-middle',
    );
    expect(categoryButton).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'size-10',
      'rounded-md',
      'inset-ring-hairline',
      'inset-ring-white/10',
      'bg-white/5',
      'text-[#cbd5e0]',
    );
    expect(categoryButton.querySelector('.lucide-tag')).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear group color/category',
    });
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Delete group' }),
    ).toBeInTheDocument();
  });

  it('deletes a group from its detail and returns goals to the ungrouped list', async () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));

    expect(screen.getByText('Delete this group?')).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete group' }).at(-1)!,
    );

    await waitFor(() => {
      expect(softDeleteGoalGroupMock).toHaveBeenCalledWith({
        scope,
        goalGroupId: 'group-1',
      });
      expect(routerPushMock).toHaveBeenCalledWith('/goals');
    });
  });

  it('shows a tooltip on the independent group color selector', async () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));
    fireEvent.focus(screen.getByLabelText('Assign independent color'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Assign independent color',
    );
  });

  it('renders group goals without an extra wrapper card and adds New goal as a tile', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));

    const newGoalCard = screen.getByRole('button', { name: 'New goal' });

    expect(newGoalCard).toHaveClass(
      'h-32',
      'justify-center',
      'rounded-[1.35rem]',
    );
    expect(newGoalCard.querySelector('rect')?.style.strokeDasharray).toBe(
      '7 6',
    );
    expect(
      screen.queryByRole('heading', { name: 'Life' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('This group has no goals yet. Create the first goal.'),
    ).not.toBeInTheDocument();
  });

  it('opens a goal detail preserving the goal step surface', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-1');
    expect(screen.getByLabelText('Rename goal')).toHaveValue('Focus');
    expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
  });

  it('creates a local goal step draft after flushing the edited row', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByDisplayValue('Existing step');
    fireEvent.change(input, { target: { value: 'Edited step' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(updateGoalStepTextMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
        text: 'Edited step',
      });
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
  });

  it('persists a goal step draft without removing it from the screen', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.keyDown(screen.getByDisplayValue('Existing step'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a step')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft step' } });
    fireEvent.blur(draftInput);

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        id: expect.any(String),
        parentId: null,
        afterGoalStepId: 'goal-step-1',
        bold: false,
        scheduledDate: null,
        text: 'Draft step',
      });
    });
    expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    expect(draftInput).toBeInTheDocument();
  });

  it('allows creating multiple empty root goal step drafts without saving them', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this goal by adding a step',
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
  });

  it('indents and outdents an empty goal step draft locally', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.keyDown(screen.getByDisplayValue('Existing step'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a step')[1];
    const draftRow = draftInput.closest('[data-tree-row]');

    expect(draftRow).not.toBeNull();

    fireEvent.click(
      within(draftRow as HTMLElement).getByLabelText('Make substep'),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '14px',
      });
    });

    const indentedRow = draftInput.closest('[data-tree-row]');
    fireEvent.click(
      within(indentedRow as HTMLElement).getByLabelText(
        'Promote step one level',
      ),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '0px',
      });
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
  });

  it('collapses and expands children of an empty goal step draft locally', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this goal by adding a step',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });

    const [parentInput, childInput] =
      screen.getAllByPlaceholderText('Write a step');
    const childRow = childInput.closest('[data-tree-row]');
    fireEvent.click(
      within(childRow as HTMLElement).getByLabelText('Make substep'),
    );

    await waitFor(() => {
      expect(childInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '14px',
      });
    });

    const parentRow = parentInput.closest('[data-tree-row]');
    fireEvent.click(
      within(parentRow as HTMLElement).getByLabelText('Collapse step'),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(1);
    });

    fireEvent.click(
      within(parentRow as HTMLElement).getByLabelText('Expand step'),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
  });

  it('hides a deleted goal step while the local delete is still pending', async () => {
    let resolveDelete!: () => void;
    softDeleteGoalStepMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    const stepRow = screen
      .getByDisplayValue('Existing step')
      .closest('[data-tree-row]');

    fireEvent.click(
      within(stepRow as HTMLElement).getByLabelText('More actions'),
    );
    fireEvent.click(screen.getByLabelText('Delete step'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue('Existing step'),
      ).not.toBeInTheDocument();
    });

    resolveDelete();
  });

  it('keeps a goal-step parent visible while optimistically collapsing children', async () => {
    let resolveCollapse!: () => void;
    toggleGoalStepCollapsedMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCollapse = resolve;
      }),
    );
    const parent = goalStep({ text: 'Parent step' });
    parent.childCount = 1;
    parent.hasChildren = true;
    const child = goalStep({
      id: 'goal-step-child',
      parentId: 'goal-step-1',
      text: 'Child step',
    });
    child.depth = 1;
    useGoalStepTreeMock.mockReturnValue([parent, child]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen
        .getAllByLabelText('Collapse step')
        .find((button) => !button.hasAttribute('disabled'))!,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Parent step')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Child step')).not.toBeInTheDocument();
    });

    resolveCollapse();
  });

  it('bulk toggles selected goal steps from the checkbox', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep(),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getAllByLabelText('Select step')[0]);
    fireEvent.click(screen.getByLabelText('Select step'));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1', 'goal-step-2'],
        completed: true,
        ignored: false,
      });
    });
  });

  it('bulk advances selected completed goal steps to ignored', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep({ completed: true }),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getAllByLabelText('Select step')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1'],
        completed: false,
        ignored: true,
      });
    });
  });

  it('bulk completes selected goal steps from the collective action', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep(),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    const selectionButtons = screen.getAllByLabelText('Select step');
    fireEvent.click(selectionButtons[0]);
    fireEvent.click(selectionButtons[1]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark · 2 steps selected' }),
    );

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1', 'goal-step-2'],
        completed: true,
        ignored: false,
      });
    });
  });

  it('advances the collective completion action of goal steps to ignored', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep({ completed: true }),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        completed: true,
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    const selectionButtons = screen.getAllByLabelText('Select step');
    fireEvent.click(selectionButtons[0]);
    fireEvent.click(selectionButtons[1]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark · 2 steps selected' }),
    );

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1', 'goal-step-2'],
        completed: false,
        ignored: true,
      });
    });
  });

  it('removes local sibling drafts anchored to a bulk-deleted goal step', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep(),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.keyDown(screen.getByDisplayValue('Existing step'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(3);
    });

    const draftInput = screen.getAllByPlaceholderText('Write a step')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft fragment' } });
    fireEvent.click(screen.getAllByLabelText('Select step')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 step selected' }),
    );
    expect(
      await screen.findByText('You are about to delete 1 selected record.'),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
      });
    });

    expect(
      screen.queryByDisplayValue('Draft fragment'),
    ).not.toBeInTheDocument();
    const createdDraftId = createGoalStepMock.mock.calls[0]?.[0].id;
    expect(createdDraftId).toEqual(expect.any(String));
    expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
      scope,
      goalStepId: createdDraftId,
    });
  });

  it('asks for confirmation before restoring an archived goal from the card menu', async () => {
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

    expect(screen.getByText('Restore this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore goal' }));

    await waitFor(() => {
      expect(reopenGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Archived' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Active' }),
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation before archiving a goal from the card menu', async () => {
    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }));

    expect(screen.getAllByText('Archive goal')).toHaveLength(2);
    expect(screen.getByText('Archive this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }));

    await waitFor(() => {
      expect(completeGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Active' })).toBeVisible();
  });

  it('renders the uncategorized goal trigger as an action box in the goal header', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const categoryButton = screen.getByRole('button', {
      name: 'Assign goal category',
    });

    expect(categoryButton).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'size-10',
      'rounded-md',
      'inset-ring-hairline',
      'inset-ring-white/10',
      'bg-white/5',
      'text-[#cbd5e0]',
    );
    expect(categoryButton.querySelector('.lucide-tag')).not.toBeNull();
    expect(categoryButton).not.toHaveTextContent('Modo local');
  });

  it('shows a tooltip on the independent goal color selector', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.focus(screen.getByLabelText('Assign independent color'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Assign independent color',
    );
  });

  it('keeps the independent color swatch click-through so the whole control opens the picker', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const colorInput = screen.getByLabelText('Assign independent color');
    const swatch = colorInput.parentElement?.querySelector(
      '[aria-hidden="true"]',
    );

    expect(swatch).toHaveClass('pointer-events-none');
  });

  it('renders the selected goal category as a pill badge in the goal header', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          categoryTagId: 'category-1',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const categoryButton = screen.getByRole('button', {
      name: 'Assign goal category',
    });
    const categoryBadge = screen.getByText('Modo local').parentElement;

    expect(categoryButton).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'size-10',
      'rounded-md',
      'inset-ring-hairline',
      'inset-ring-white/10',
      'bg-white/5',
      'text-[#cbd5e0]',
    );
    expect(categoryButton.querySelector('.lucide-tag')).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear goal color/category',
    });
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    expect(categoryBadge).toHaveClass(
      'inline-flex',
      'min-h-10',
      'max-w-full',
      'rounded-full',
      'inset-ring-hairline',
      'px-3',
      'py-1',
      'text-sm',
      'font-medium',
      'text-[#f7e8ce]',
    );
    expect(categoryBadge).toHaveTextContent('Modo local');
    expect(categoryBadge?.querySelector('.rounded-full')).toBeNull();
    expect(categoryBadge).toHaveStyle({
      '--chip-edge': 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });
  });

  it('renders the goal due date as a badge and updates it from the picker', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          dueDate: '2026-08-20',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(screen.getByText('Aug 20, 2026')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open date picker for Goal date' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'August 25, 2026' }));

    expect(updateGoalDueDateMock).toHaveBeenCalledWith({
      scope,
      goalId: 'goal-1',
      dueDate: '2026-08-25',
    });
  });

  it('clears the goal due date from the picker popover', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          dueDate: '2026-08-20',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Open date picker for Goal date' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));

    expect(updateGoalDueDateMock).toHaveBeenCalledWith({
      scope,
      goalId: 'goal-1',
      dueDate: null,
    });
  });

  it('does not render a due date badge when the goal has no due date', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(
      screen.getByRole('button', { name: 'Open date picker for Goal date' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\w+ \d{1,2}, 2026/)).not.toBeInTheDocument();
  });

  describe('goal step date field visibility preference', () => {
    afterEach(async () => {
      await db.localPreferences.clear();
    });

    it('hides the goal step date field after toggling it off in the preferences dialog and keeps it hidden', async () => {
      useGoalStepTreeMock.mockReturnValue([goalStep()]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

      expect(
        screen.getByRole('button', { name: 'Open date picker for Step date' }),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );
      fireEvent.click(screen.getByRole('radio', { name: 'Step date: Hidden' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(
          screen.queryByRole('button', {
            name: 'Open date picker for Step date',
          }),
        ).not.toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );

      expect(
        screen.getByRole('radio', { name: 'Step date: Hidden' }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('goal step category tabs', () => {
    const focusTag = {
      id: 'focus',
      name: 'FOCUS',
      colorHex: '#2563eb',
      position: '1',
      surface: 'goal_step',
      useOwnName: false,
    };
    const homeTag = {
      id: 'home',
      name: 'HOME',
      colorHex: '#d97706',
      position: '2',
      surface: 'goal_step',
      useOwnName: false,
    };

    async function selectTabView() {
      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );
      fireEvent.click(
        screen.getByRole('radio', { name: 'Step view: Category tabs' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await screen.findByRole('tablist', { name: 'Step categories' });
    }

    beforeEach(async () => {
      await db.localPreferences.clear();
      useCategoryTagsMock.mockImplementation((_scope, surface) =>
        surface === 'goal_step' ? [focusTag, homeTag] : [],
      );
    });

    afterEach(async () => {
      await db.localPreferences.clear();
    });

    it('keeps a single list until the tab view is chosen in the preferences', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

      await selectTabView();

      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'All',
        'FOCUS',
        'No category',
      ]);
    });

    it('shows the whole subtree of the root steps in the selected tab', async () => {
      const child = goalStep({
        id: 'goal-step-1-1',
        text: 'Focus substep',
        parentId: 'goal-step-1',
        sortRank: 'i',
      });
      child.depth = 1;
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        child,
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();

      fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));

      expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Focus substep')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Loose step')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'No category' }));

      expect(screen.getByDisplayValue('Loose step')).toBeInTheDocument();
      expect(
        screen.queryByDisplayValue('Existing step'),
      ).not.toBeInTheDocument();
    });

    it('omits the uncategorized tab when every root step has a category', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({
          id: 'goal-step-2',
          text: 'Home step',
          categoryTagId: 'home',
          sortRank: 'j',
        }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();

      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'All',
        'FOCUS',
        'HOME',
      ]);
    });

    it('hides the tab strip while no root step has a category', async () => {
      useGoalStepTreeMock.mockReturnValue([goalStep()]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );
      fireEvent.click(
        screen.getByRole('radio', { name: 'Step view: Category tabs' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Configure step actions' }),
        ).toBeInTheDocument();
      });

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('restores the tab view from the stored preference', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      const { unmount } = render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();
      unmount();

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

      expect(
        await screen.findByRole('tablist', { name: 'Step categories' }),
      ).toBeInTheDocument();
    });

    it('creates new root steps inside the active category tab', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();

      fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

      const draftInput = await waitFor(() => {
        const emptyInput = screen
          .getAllByPlaceholderText('Write a step')
          .find((input) => (input as HTMLTextAreaElement).value === '');

        expect(emptyInput).toBeDefined();
        return emptyInput as HTMLElement;
      });
      fireEvent.change(draftInput, { target: { value: 'New focus step' } });
      fireEvent.blur(draftInput);

      await waitFor(() => {
        expect(createGoalStepMock).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'New focus step' }),
        );
        expect(assignGoalStepCategoryMock).toHaveBeenCalledWith(
          expect.objectContaining({ categoryTagId: 'focus' }),
        );
      });
    });
  });

  it('keeps a date selected on a still-draft goal step visible and carries it over once persisted', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Start this goal by adding a step' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open date picker for Step date' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    const trigger = screen.getByRole('button', {
      name: 'Open date picker for Step date',
    });

    expect(trigger.textContent).toMatch(/^\d{2}\/\d{2}$/);
    const shortLabel = trigger.textContent;

    const input = screen.getByPlaceholderText('Write a step');
    fireEvent.change(input, { target: { value: 'Buy groceries' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Buy groceries',
          scheduledDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      );
    });

    expect(
      screen.getByRole('button', { name: 'Open date picker for Step date' }),
    ).toHaveTextContent(shortLabel as string);
  });

  it('renders the goal category as a color dot instead of a text badge when useOwnName is true', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal') {
        return [
          {
            id: 'category-1',
            name: '',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal',
            useOwnName: true,
          },
        ];
      }

      return [];
    });
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          categoryTagId: 'category-1',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    const { container } = render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(screen.queryByText('Modo local')).not.toBeInTheDocument();

    const dot = Array.from(container.querySelectorAll('span')).find(
      (element) =>
        element.className.includes('inset-ring-white/30') &&
        element.className.includes('rounded-full'),
    );

    expect(dot).toBeDefined();
    expect(dot).toHaveStyle({ backgroundColor: '#f97316' });
  });

  it('uses an adaptive title width with only a max width in the goal header', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByLabelText('Rename goal');
    const wrapper = input.parentElement;

    expect(input).not.toHaveAttribute('placeholder');
    expect(input).not.toHaveClass('flex-1');
    expect(input).toHaveClass('absolute', 'inset-0', 'w-full', 'px-2');
    expect(wrapper).toHaveClass(
      'relative',
      'inline-block',
      'min-w-0',
      'shrink',
    );
    expect(wrapper).not.toHaveStyle({
      maxWidth: 'min(100%, 24rem)',
    });
  });

  it('does not persist an empty goal title and restores the previous title on blur', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByLabelText('Rename goal');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateGoalTitleMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Rename goal')).toHaveValue('Focus');
    });
  });

  it('asks for confirmation before archiving a goal from the detail header', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }));

    expect(screen.getByText('Archive this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive goal' })[1]);

    await waitFor(() => {
      expect(completeGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Active' })).toBeVisible();
  });

  it('asks for confirmation before restoring an archived goal from the detail header', async () => {
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
    useGoalStepTreeMock.mockReturnValue([
      goalStep({ goalId: 'goal-archived' }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore goal' }));

    expect(screen.getByText('Restore this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Restore goal' })[1]);

    await waitFor(() => {
      expect(reopenGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Archived' })).toBeVisible();
  });
});
