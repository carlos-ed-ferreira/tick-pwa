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
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';

const scope = {
  id: 'guest:test',
  kind: 'guest' as const,
  ownerId: 'test',
};

const {
  assignGoalCategoryMock,
  assignGoalGroupCategoryMock,
  completeGoalMock,
  createCategoryTagMock,
  createGoalMock,
  createGoalStepMock,
  groupGoalsTogetherMock,
  moveGoalToGroupMock,
  reopenGoalMock,
  routerPushMock,
  setGoalStepsCompletedMock,
  softDeleteGoalStepMock,
  softDeleteGoalGroupMock,
  updateCategoryTagMock,
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
  completeGoalMock: vi.fn().mockResolvedValue(undefined),
  createCategoryTagMock: vi.fn(),
  createGoalMock: vi.fn(),
  createGoalStepMock: vi.fn(),
  groupGoalsTogetherMock: vi.fn().mockResolvedValue({ id: 'group-new' }),
  moveGoalToGroupMock: vi.fn().mockResolvedValue(undefined),
  reopenGoalMock: vi.fn().mockResolvedValue(undefined),
  routerPushMock: vi.fn(),
  setGoalStepsCompletedMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalStepMock: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalGroupMock: vi.fn().mockResolvedValue(undefined),
  updateCategoryTagMock: vi.fn().mockResolvedValue(undefined),
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
  assignGoalStepCategory: vi.fn().mockResolvedValue(undefined),
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
  softDeleteGoal: vi.fn().mockResolvedValue(undefined),
  softDeleteGoalGroup: softDeleteGoalGroupMock,
  softDeleteGoalStep: softDeleteGoalStepMock,
  toggleGoalStepChecked: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepCollapsed: vi.fn().mockResolvedValue(undefined),
  toggleGoalStepPriority: vi.fn().mockResolvedValue(undefined),
  updateCategoryTag: updateCategoryTagMock,
  updateGoalGroupTitle: vi.fn().mockResolvedValue(undefined),
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
        moreActions: 'More actions',
        outdentItem: 'Outdent item',
        markPriority: 'Mark as priority',
        unmarkPriority: 'Remove priority',
        makeTextBold: 'Make text bold',
        makeTextNormal: 'Make text normal',
        deleteItem: 'Delete item',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        confirmDeleteItem: 'Are you sure?',
        selectItem: 'Select item',
        deselectItem: 'Deselect item',
        itemSelected: '{count} item selected',
        itemsSelected: '{count} selected',
        bulkDeleteItems: 'Delete selected',
        confirmBulkDeleteItem:
          'You are about to delete {count} selected record.',
        confirmBulkDeleteItems:
          'You are about to delete {count} selected records.',
        clearSelection: 'Clear selection',
        bulkPriority: 'Priority',
        bulkBold: 'Bold',
        bulkCategory: 'Category',
        bulkDelete: 'Delete',
      },
      goals: {
        activeGoals: 'Active',
        archivedGoals: 'Archived',
        addStep: 'Add step',
        assignGoalCategory: 'Assign goal category',
        assignGoalCategoryMenu: 'Assign category',
        assignGoalColor: 'Assign independent color',
        clearGoalCategory: 'Clear goal color/category',
        assignGroupCategory: 'Assign group category',
        assignGroupCategoryMenu: 'Assign category',
        assignGroupColor: 'Assign independent color',
        backToGoalGroups: 'Back to goal groups',
        completeGoal: 'Archive goal',
        confirmCompleteGoal: 'Archive this goal?',
        confirmDeleteGoal: 'Delete this goal?',
        deleteGoal: 'Delete goal',
        dragGoal: 'Drag goal',
        emptyGoal: 'Start this goal with a checklist item',
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
    scope,
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
  it('uses the requested pt-BR labels in the goal card menu', () => {
    expect(ptBRDictionary.dayEditor.itemSelected).toBe('{count} selecionado');
    expect(ptBRDictionary.dayEditor.itemsSelected).toBe('{count} selecionados');
    expect(ptBRDictionary.dayEditor.confirmBulkDeleteItem).toBe(
      'Você está prestes a excluir {count} registro selecionado.',
    );
    expect(ptBRDictionary.dayEditor.confirmBulkDeleteItems).toBe(
      'Você está prestes a excluir {count} registros selecionados.',
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
    groupGoalsTogetherMock.mockClear();
    moveGoalToGroupMock.mockClear();
    reopenGoalMock.mockClear();
    routerPushMock.mockClear();
    setGoalStepsCompletedMock.mockClear();
    softDeleteGoalStepMock.mockClear();
    softDeleteGoalGroupMock.mockClear();
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
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Health').parentElement).toHaveClass(
      'px-4',
      'leading-tight',
    );
    expect(screen.queryByText('2/3')).not.toBeInTheDocument();
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
    ).toHaveClass('border-0');
    expect(screen.getByLabelText('Assign independent color')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Assign category' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Clear group color/category' }),
    ).toBeVisible();
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
      'border',
      'px-3',
      'py-1',
      'text-[0.68rem]',
      'font-semibold',
      'uppercase',
      'tracking-[0.24em]',
      'text-[#f7e8ce]',
      'shadow-sm',
      'shadow-[#312c51]/10',
    );
    expect(badge).toHaveStyle({
      borderColor: 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });
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

    expect(pill).toHaveClass('rounded-full', 'border');
    expect(pill).toHaveStyle({
      borderColor: 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });

    const dot = Array.from(container.querySelectorAll('span')).find(
      (element) =>
        element.className.includes('border-white/30') &&
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
    ).toHaveClass('border-0');
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
      'border-0',
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear goal color/category' }),
    );

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
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
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
      'border',
      'border-white/10',
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
      'size-10',
      'rounded-md',
      'border',
      'border-white/10',
      'bg-white/5',
      'text-[#d8d0e8]',
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
      'border-dashed',
      'justify-center',
      'rounded-[1.35rem]',
    );
    expect(
      screen.queryByRole('heading', { name: 'Life' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('This group has no goals yet. Create the first goal.'),
    ).not.toBeInTheDocument();
  });

  it('opens a goal detail preserving the checklist item surface', () => {
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
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
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
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
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
        text: 'Draft step',
      });
    });
    expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    expect(draftInput).toBeInTheDocument();
  });

  it('allows creating multiple empty root goal step drafts without saving them', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this goal with a checklist item',
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
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
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
    const draftRow = draftInput.closest('[data-tree-row]');

    expect(draftRow).not.toBeNull();

    fireEvent.click(
      within(draftRow as HTMLElement).getByLabelText('Indent item'),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '14px',
      });
    });

    const indentedRow = draftInput.closest('[data-tree-row]');
    fireEvent.click(
      within(indentedRow as HTMLElement).getByLabelText('Outdent item'),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '0px',
      });
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(screen.getByLabelText('Select item'));
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
    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
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
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(3);
    });

    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft fragment' } });
    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 item selected' }),
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
  });

  it('renders the uncategorized goal trigger as an action box in the goal header', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const categoryButton = screen.getByRole('button', {
      name: 'Assign goal category',
    });

    expect(categoryButton).toHaveClass(
      'size-10',
      'rounded-md',
      'border',
      'border-white/10',
      'bg-white/5',
      'text-[#d8d0e8]',
    );
    expect(categoryButton).not.toHaveTextContent('Modo local');
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
      'size-10',
      'rounded-md',
      'border',
      'border-white/10',
      'bg-white/5',
      'text-[#d8d0e8]',
    );
    expect(categoryBadge).toHaveClass(
      'inline-flex',
      'min-h-10',
      'max-w-full',
      'rounded-full',
      'border',
      'px-3',
      'py-1',
      'text-sm',
      'font-medium',
      'text-[#f7e8ce]',
    );
    expect(categoryBadge).toHaveTextContent('Modo local');
    expect(categoryBadge?.querySelector('.rounded-full')).toBeNull();
    expect(categoryBadge).toHaveStyle({
      borderColor: 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });
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
        element.className.includes('border-white/30') &&
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
  });
});
