import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { AppScope } from '@/lib/domain';

export const scope: AppScope = {
  id: 'guest:test',
  kind: 'guest',
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
        chooseCompletionState: 'Choose marking state',
        completionIgnoredState: 'Ignored state',
        completionLevels: 'Marking levels',
        completionStateCompleted: 'Marked',
        completionStateIgnored: 'Ignored',
        completionStateLevel: 'Level {level} of {levels}',
        completionStateUnchecked: 'Unchecked',
        settingDisabled: 'Disabled',
        settingEnabled: 'Enabled',
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
        editCategories: 'Edit goal categories',
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
        ignoredStep: '{count} ignored',
        ignoredSteps: '{count} ignored',
        goalProgressStep: '{completed} of {total} completed',
        goalProgressSteps: '{completed} of {total} completed',
        moveTo: 'Move to',
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
      navigation: {
        categories: 'Categories',
        goals: 'Goals',
        moreOptions: 'More options',
      },
    },
    locale: 'en',
    scope,
    timezonePreference: {
      timezone: 'America/Sao_Paulo',
    },
  }),
}));

vi.mock('@/features/categories/category-manager', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/categories/category-manager')
  >()),
  CategoryManagerDialog: ({
    open,
    surface,
    title,
  }: {
    open: boolean;
    surface: string;
    title: string;
  }) =>
    open ? (
      <div aria-label={title} data-surface={surface} role="dialog" />
    ) : null,
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

export function goal(overrides: Record<string, unknown>) {
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

export function group(overrides: Record<string, unknown>) {
  return {
    id: 'group-1',
    title: 'Life',
    categoryTagId: null,
    sortRank: 'U',
    ...overrides,
  };
}

export function goalStep(overrides: Record<string, unknown> = {}) {
  return {
    goalStep: {
      id: 'goal-step-1',
      goalId: 'goal-1',
      parentId: null,
      text: 'Existing step',
      completed: false,
      ignored: false,
      markLevel: 0,
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

export {
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
};
