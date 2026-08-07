import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChecklistSurface } from '@/features/checklist/checklist-surface';
import { db } from '@/lib/db/database';

const {
  assignChecklistItemCategoryMock,
  createChecklistItemMock,
  moveChecklistItemToParentMock,
  moveChecklistItemToTargetMock,
  reorderChecklistItemMock,
  reorderChecklistItemsByScheduledTimeMock,
  setChecklistItemsCheckedMock,
  softDeleteChecklistItemMock,
  toggleChecklistItemBoldMock,
  toggleChecklistItemCollapsedMock,
  toggleChecklistItemPriorityMock,
  updateChecklistItemScheduledTimeMock,
  updateChecklistItemTextMock,
  useCategoryTagsMock,
  useChecklistTreeMock,
} = vi.hoisted(() => ({
  assignChecklistItemCategoryMock: vi.fn().mockResolvedValue(undefined),
  useCategoryTagsMock: vi.fn(() => [] as unknown[]),
  createChecklistItemMock: vi.fn().mockResolvedValue({ id: 'new-item' }),
  moveChecklistItemToParentMock: vi.fn().mockResolvedValue(undefined),
  moveChecklistItemToTargetMock: vi.fn().mockResolvedValue(undefined),
  reorderChecklistItemMock: vi.fn().mockResolvedValue(undefined),
  reorderChecklistItemsByScheduledTimeMock: vi
    .fn()
    .mockResolvedValue(undefined),
  setChecklistItemsCheckedMock: vi.fn().mockResolvedValue(undefined),
  softDeleteChecklistItemMock: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemBoldMock: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemCollapsedMock: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemPriorityMock: vi.fn().mockResolvedValue(undefined),
  updateChecklistItemScheduledTimeMock: vi.fn().mockResolvedValue(undefined),
  updateChecklistItemTextMock: vi.fn().mockResolvedValue(undefined),
  useChecklistTreeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  assignChecklistItemCategory: assignChecklistItemCategoryMock,
  createChecklistChild: vi.fn().mockResolvedValue(undefined),
  createChecklistItem: createChecklistItemMock,
  indentChecklistItem: vi.fn().mockResolvedValue(undefined),
  moveChecklistItemToParent: moveChecklistItemToParentMock,
  moveChecklistItemToTarget: moveChecklistItemToTargetMock,
  outdentChecklistItem: vi.fn().mockResolvedValue(undefined),
  reorderChecklistItem: reorderChecklistItemMock,
  reorderChecklistItemsByScheduledTime:
    reorderChecklistItemsByScheduledTimeMock,
  setChecklistItemsChecked: setChecklistItemsCheckedMock,
  softDeleteChecklistItem: softDeleteChecklistItemMock,
  toggleChecklistItemChecked: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemBold: toggleChecklistItemBoldMock,
  toggleChecklistItemCollapsed: toggleChecklistItemCollapsedMock,
  toggleChecklistItemPriority: toggleChecklistItemPriorityMock,
  updateChecklistItemScheduledTime: updateChecklistItemScheduledTimeMock,
  updateChecklistItemText: updateChecklistItemTextMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      actions: {
        cancel: 'Cancel',
        delete: 'Delete',
      },
      calendar: {
        sortByTime: 'Sort by time',
        viewMode: 'Task view',
        viewModeList: 'Single list',
        viewModeTabs: 'Category tabs',
        categoryTabs: 'Task categories',
        categoryTabAll: 'All',
        categoryTabUncategorized: 'No category',
      },
      dayEditor: {
        addItem: 'Add task',
        emptyChecklist: 'Start this day with a task',
        expandItem: 'Expand task',
        collapseItem: 'Collapse task',
        toggleItem: 'Change task status',
        itemPlaceholder: 'Write a task',
        addChild: 'Create subtask',
        indentItem: 'Make subtask',
        dragItem: 'Drag task',
        itemTime: 'Task time',
        markPriority: 'Mark as priority',
        moveItemDown: 'Move task down',
        moveItemUp: 'Move task up',
        moreActions: 'More actions',
        outdentItem: 'Promote task one level',
        unmarkPriority: 'Remove priority',
        deleteItem: 'Delete task',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        confirmDeleteItem: 'Are you sure you want to delete this task?',
        selectItem: 'Select task',
        deselectItem: 'Deselect task',
        itemSelected: '{count} task selected',
        itemsSelected: '{count} tasks selected',
        bulkDeleteItems: 'Delete selected tasks',
        confirmBulkDeleteItem:
          'You are about to delete {count} selected record.',
        confirmBulkDeleteItems:
          'You are about to delete {count} selected records.',
        clearSelection: 'Clear selection',
        bulkPriority: 'Priority',
        bulkBold: 'Bold',
        bulkCategory: 'Category',
        bulkDelete: 'Delete',
        actionHidden: 'Hidden',
        actionInMenu: 'Three-dot menu',
        actionOnRow: 'On row',
        actionVisible: 'Visible',
        configurePreferences: 'Configure task actions',
        dragAndDrop: 'Drag and drop',
        preferencesTitle: 'Task actions',
        resetPreferences: 'Restore defaults',
      },
    },
    scope: {
      id: 'guest:test',
      kind: 'guest',
      ownerId: 'test',
    },
    locale: 'en',
    timezonePreference: {
      timezone: 'America/Sao_Paulo',
    },
  }),
}));

vi.mock('@/features/categories', () => ({
  CategoryAssignmentMenu: () => null,
  useCategoryTags: () => useCategoryTagsMock(),
}));

vi.mock('@/features/checklist/use-checklist-tree', () => ({
  useChecklistTree: useChecklistTreeMock,
}));

function createRow(
  text: string,
  overrides: Partial<{
    checked: boolean;
    ignored: boolean;
    priority: boolean;
    categoryTagId: string | null;
  }> = {},
) {
  const now = new Date().toISOString();

  return {
    item: {
      id: `item-${text || 'empty'}`,
      scopeId: 'guest:test',
      dailyEntryId: 'entry-1',
      parentId: null,
      text,
      scheduledTime: null,
      checked: overrides.checked ?? false,
      ignored: overrides.ignored ?? false,
      priority: overrides.priority ?? false,
      collapsed: false,
      categoryTagId: overrides.categoryTagId ?? null,
      sortRank: 'U',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local' as const,
      remoteRevision: null,
      clientUpdatedAt: now,
    },
    depth: 0,
    childCount: 0,
    hasChildren: false,
    isFirstSibling: false,
    isLastSibling: false,
  };
}

describe('ChecklistSurface delete confirmation', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await db.localPreferences.clear();
    assignChecklistItemCategoryMock.mockClear();
    useCategoryTagsMock.mockReset();
    useCategoryTagsMock.mockReturnValue([]);
    useChecklistTreeMock.mockReset();
    createChecklistItemMock.mockClear();
    createChecklistItemMock.mockResolvedValue({ id: 'new-item' });
    moveChecklistItemToParentMock.mockClear();
    moveChecklistItemToTargetMock.mockClear();
    reorderChecklistItemMock.mockClear();
    reorderChecklistItemsByScheduledTimeMock.mockClear();
    setChecklistItemsCheckedMock.mockClear();
    softDeleteChecklistItemMock.mockClear();
    toggleChecklistItemBoldMock.mockClear();
    toggleChecklistItemCollapsedMock.mockClear();
    toggleChecklistItemPriorityMock.mockClear();
    updateChecklistItemTextMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('asks for confirmation before deleting a non-empty row', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Important task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getAllByLabelText('Delete task')[0]);

    expect(
      await screen.findByText('Are you sure you want to delete this task?'),
    ).toBeInTheDocument();
    expect(softDeleteChecklistItemMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Important task',
      });
    });
  });

  it('deletes immediately when the row is empty', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getAllByLabelText('Delete task')[0]);

    await waitFor(() => {
      expect(softDeleteChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-empty',
      });
    });
    expect(
      screen.queryByText('Are you sure you want to delete this task?'),
    ).not.toBeInTheDocument();
  });

  it('hides a deleted row while the local delete is still pending', async () => {
    let resolveDelete!: () => void;
    softDeleteChecklistItemMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    useChecklistTreeMock.mockReturnValue([createRow('Important task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getAllByLabelText('Delete task')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue('Important task'),
      ).not.toBeInTheDocument();
    });

    resolveDelete();
  });

  it('keeps the parent visible while optimistically collapsing its children', async () => {
    let resolveCollapse!: () => void;
    toggleChecklistItemCollapsedMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCollapse = resolve;
      }),
    );
    const parent = createRow('Parent task');
    parent.childCount = 1;
    parent.hasChildren = true;
    const child = createRow('Child task');
    (child.item as { parentId: string | null }).parentId = parent.item.id;
    child.depth = 1;
    useChecklistTreeMock.mockReturnValue([parent, child]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(
      screen
        .getAllByLabelText('Collapse task')
        .find((button) => !button.hasAttribute('disabled'))!,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Parent task')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Child task')).not.toBeInTheDocument();
    });

    resolveCollapse();
  });

  it('reorders a row with drag and drop', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: '',
      getData: (type: string) => data.get(type) ?? '',
      setData: (type: string, value: string) => data.set(type, value),
    };
    const firstHandle = screen.getAllByLabelText('Drag task')[0];
    const secondRow = screen.getByDisplayValue('Second task').closest('.group');

    expect(secondRow).not.toBeNull();

    fireEvent.dragStart(firstHandle, { dataTransfer });
    fireEvent.drop(secondRow as Element, {
      clientY: 999,
      dataTransfer,
    });

    await waitFor(() => {
      expect(moveChecklistItemToTargetMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-First task',
        targetItemId: 'item-Second task',
        placement: 'after',
      });
    });
  });

  it('moves a row down through the row action button', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const firstRow = screen.getByDisplayValue('First task').closest('.group');

    expect(firstRow).not.toBeNull();
    fireEvent.click(
      within(firstRow as HTMLElement).getByRole('button', {
        name: 'Move task down',
      }),
    );

    await waitFor(() => {
      expect(moveChecklistItemToTargetMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-First task',
        targetItemId: 'item-Second task',
        placement: 'after',
      });
    });
  });

  it('persists where row actions are displayed', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    const { unmount } = render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure task actions' }),
    );
    fireEvent.click(
      screen.getByRole('radio', {
        name: 'Move task down: Hidden',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Move task down' }),
      ).not.toBeInTheDocument();
    });

    unmount();
    render(<ChecklistSurface dailyEntryId="entry-1" />);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Move task down' }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getAllByRole('button', { name: 'Move task up' }),
    ).toHaveLength(2);
  });

  it('places icon-only sort and preference actions after the global add button', () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const addButton = screen.getByRole('button', { name: 'Add task' });
    const toolbar = addButton.parentElement;
    const toolbarButtons = Array.from(
      toolbar?.querySelectorAll('button') ?? [],
    ).map((button) => button.getAttribute('aria-label') ?? button.textContent);

    expect(toolbarButtons).toEqual([
      'Add task',
      'Sort by time',
      'Configure task actions',
    ]);

    const sortButton = screen.getByRole('button', { name: 'Sort by time' });
    const preferencesButton = screen.getByRole('button', {
      name: 'Configure task actions',
    });

    expect(sortButton).not.toHaveAttribute('title');
    expect(preferencesButton).not.toHaveAttribute('title');
    expect(sortButton).not.toHaveTextContent('Sort by time');
    expect(preferencesButton).not.toHaveTextContent('Configure task actions');

    fireEvent.focus(sortButton);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Sort by time');
    fireEvent.blur(sortButton);
    fireEvent.focus(preferencesButton);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Configure task actions',
    );

    fireEvent.click(sortButton);
    expect(reorderChecklistItemsByScheduledTimeMock).toHaveBeenCalledWith({
      scope: {
        id: 'guest:test',
        kind: 'guest',
        ownerId: 'test',
      },
      dailyEntryId: 'entry-1',
    });
  });

  it('moves a row into another row through its child drop zone', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Parent task'),
      createRow('Child task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: '',
      getData: (type: string) => data.get(type) ?? '',
      setData: (type: string, value: string) => data.set(type, value),
    };
    const childHandle = screen.getAllByLabelText('Drag task')[1];
    const parentRow = screen.getByDisplayValue('Parent task').closest('.group');

    expect(parentRow).not.toBeNull();
    Object.defineProperty(parentRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    fireEvent.dragStart(childHandle, { dataTransfer });
    fireEvent.drop(parentRow as Element, {
      clientY: 50,
      dataTransfer,
    });

    await waitFor(() => {
      expect(moveChecklistItemToParentMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Child task',
        parentItemId: 'item-Parent task',
      });
    });
  });

  it('does not send an unpersisted draft to checklist reordering', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Original task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.keyDown(screen.getByDisplayValue('Original task'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: '',
      getData: (type: string) => data.get(type) ?? '',
      setData: (type: string, value: string) => data.set(type, value),
    };
    const draftHandle = screen.getAllByLabelText('Drag task')[1];
    const persistedRow = screen
      .getByDisplayValue('Original task')
      .closest('.group');

    expect(persistedRow).not.toBeNull();

    fireEvent.dragStart(draftHandle, { dataTransfer });
    fireEvent.drop(persistedRow as Element, {
      clientY: 0,
      dataTransfer,
    });

    await waitFor(() => {
      expect(reorderChecklistItemMock).not.toHaveBeenCalled();
    });
    expect(moveChecklistItemToTargetMock).not.toHaveBeenCalled();
  });

  it('indents and outdents an empty draft locally', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Original task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.keyDown(screen.getByDisplayValue('Original task'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
    const draftRow = draftInput.closest('[data-tree-row]');

    expect(draftRow).not.toBeNull();

    fireEvent.click(
      within(draftRow as HTMLElement).getByLabelText('Make subtask'),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '14px',
      });
    });

    const indentedRow = draftInput.closest('[data-tree-row]');
    fireEvent.click(
      within(indentedRow as HTMLElement).getByLabelText(
        'Promote task one level',
      ),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '0px',
      });
    });
    expect(createChecklistItemMock).not.toHaveBeenCalled();
  });

  it('collapses and expands children of an empty draft locally', async () => {
    useChecklistTreeMock.mockReturnValue([]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this day with a task',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });

    const [parentInput, childInput] =
      screen.getAllByPlaceholderText('Write a task');
    const childRow = childInput.closest('[data-tree-row]');
    fireEvent.click(
      within(childRow as HTMLElement).getByLabelText('Make subtask'),
    );

    await waitFor(() => {
      expect(childInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '14px',
      });
    });

    const parentRow = parentInput.closest('[data-tree-row]');
    fireEvent.click(
      within(parentRow as HTMLElement).getByLabelText('Collapse task'),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(1);
    });

    fireEvent.click(
      within(parentRow as HTMLElement).getByLabelText('Expand task'),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    expect(createChecklistItemMock).not.toHaveBeenCalled();
  });

  it('toggles item priority from the row controls', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Important task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByLabelText('Mark as priority'));

    await waitFor(() => {
      expect(toggleChecklistItemPriorityMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Important task',
      });
    });
  });

  it('creates a local sibling draft after flushing the edited row', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Original task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const input = screen.getByDisplayValue('Original task');
    fireEvent.change(input, { target: { value: 'Edited task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(updateChecklistItemTextMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Original task',
        text: 'Edited task',
      });
    });
    expect(createChecklistItemMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
  });

  it('persists a sibling draft without removing it from the screen', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Original task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const input = screen.getByDisplayValue('Original task');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft task' } });
    fireEvent.blur(draftInput);

    await waitFor(() => {
      expect(createChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        dailyEntryId: 'entry-1',
        id: expect.any(String),
        parentId: null,
        afterItemId: 'item-Original task',
        scheduledTime: null,
        bold: false,
        text: 'Draft task',
      });
    });
    expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    expect(draftInput).toBeInTheDocument();
  });

  it('keeps empty drafts on blur without saving them', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Original task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.keyDown(screen.getByDisplayValue('Original task'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
    fireEvent.blur(draftInput);

    await waitFor(() => {
      expect(createChecklistItemMock).not.toHaveBeenCalled();
    });
    expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    expect(draftInput).toBeInTheDocument();
  });

  it('allows creating multiple empty root drafts without saving them', async () => {
    useChecklistTreeMock.mockReturnValue([]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this day with a task',
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
    });
    expect(createChecklistItemMock).not.toHaveBeenCalled();
  });

  it('bulk toggles selected checklist items from the checkbox', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select task')[0]);
    fireEvent.click(screen.getByLabelText('Select task'));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setChecklistItemsCheckedMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemIds: ['item-First task', 'item-Second task'],
        checked: true,
        ignored: false,
      });
    });
  });

  it('bulk advances selected completed checklist items to ignored', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task', { checked: true }),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select task')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setChecklistItemsCheckedMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemIds: ['item-First task'],
        checked: false,
        ignored: true,
      });
    });
  });

  it('shows collective actions beside the global add button and applies bold to every selected row', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const selectionButtons = screen.getAllByLabelText('Select task');
    fireEvent.click(selectionButtons[0]);
    fireEvent.click(selectionButtons[1]);
    const addButton = screen.getByRole('button', { name: 'Add task' });
    const bulkBold = screen.getByRole('button', {
      name: 'Bold · 2 tasks selected',
    });

    expect(bulkBold.closest('[data-tree-selection-actions]')).toBe(
      addButton
        .closest('[data-tree-list-toolbar]')
        ?.querySelector('[data-tree-selection-actions]'),
    );

    fireEvent.click(bulkBold);
    fireEvent.click(
      screen.getByRole('button', { name: 'Priority · 2 tasks selected' }),
    );

    await waitFor(() => {
      expect(toggleChecklistItemBoldMock).toHaveBeenCalledTimes(2);
      expect(toggleChecklistItemPriorityMock).toHaveBeenCalledTimes(2);
      expect(toggleChecklistItemBoldMock).toHaveBeenNthCalledWith(1, {
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-First task',
      });
      expect(toggleChecklistItemBoldMock).toHaveBeenNthCalledWith(2, {
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Second task',
      });
    });
  });

  it('uses the singular selection label for one selected row', () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select task')[0]);

    expect(
      screen.getByRole('button', { name: 'Priority · 1 task selected' }),
    ).toBeInTheDocument();
  });

  it('bulk deletes a selected row from selection mode', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select task')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 task selected' }),
    );

    expect(
      await screen.findByText('You are about to delete 1 selected record.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-First task',
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Clear selection' }),
      ).not.toBeInTheDocument();
    });
  });

  it('removes local sibling drafts anchored to a bulk-deleted row', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.keyDown(screen.getByDisplayValue('First task'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(3);
    });

    const draftInput = screen.getAllByPlaceholderText('Write a task')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft fragment' } });
    fireEvent.click(screen.getAllByLabelText('Select task')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 task selected' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-First task',
      });
    });

    expect(
      screen.queryByDisplayValue('Draft fragment'),
    ).not.toBeInTheDocument();
    const createdDraftId = createChecklistItemMock.mock.calls[0]?.[0].id;
    expect(createdDraftId).toEqual(expect.any(String));
    expect(softDeleteChecklistItemMock).toHaveBeenCalledWith({
      scope: {
        id: 'guest:test',
        kind: 'guest',
        ownerId: 'test',
      },
      itemId: createdDraftId,
    });
  });

  it('bulk selects a visible range with shift click', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
      createRow('Third task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select task')[0]);
    fireEvent.click(screen.getAllByLabelText('Select task')[1], {
      shiftKey: true,
    });
    fireEvent.click(
      screen.getByRole('button', { name: /^Delete · \d+ tasks selected$/ }),
    );

    expect(
      await screen.findByText('You are about to delete 3 selected records.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteChecklistItemMock).toHaveBeenCalledTimes(3);
    });
  });

  it('keeps only the left highlight when a priority item has no category', () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Important task', { priority: true }),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const input = screen.getByDisplayValue(
      'Important task',
    ) as HTMLInputElement;
    const row = input.closest('div[style]') as HTMLDivElement | null;

    expect(row).toHaveStyle({
      boxShadow:
        'inset 4px 0 0 0 rgba(240, 195, 142, 1), inset 0 0 18px rgba(240, 195, 142, 0.12)',
    });
    expect(row?.style.backgroundColor).toBe('');
    expect(input.className.includes('font-medium')).toBe(false);
  });
});

describe('ChecklistSurface category tabs', () => {
  const focusTag = {
    id: 'focus',
    name: 'FOCUS',
    colorHex: '#2563eb',
    useOwnName: false,
  };
  const homeTag = {
    id: 'home',
    name: 'HOME',
    colorHex: '#d97706',
    useOwnName: false,
  };

  function createChildRow(
    text: string,
    parentId: string,
    overrides: Parameters<typeof createRow>[1] = {},
  ) {
    const row = createRow(text, overrides);

    return {
      ...row,
      depth: 1,
      item: { ...row.item, parentId },
    };
  }

  async function selectTabView() {
    fireEvent.click(
      screen.getByRole('button', { name: 'Configure task actions' }),
    );
    fireEvent.click(
      screen.getByRole('radio', { name: 'Task view: Category tabs' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByRole('tablist', { name: 'Task categories' });
  }

  beforeEach(async () => {
    window.localStorage.clear();
    await db.localPreferences.clear();
    assignChecklistItemCategoryMock.mockClear();
    createChecklistItemMock.mockClear();
    createChecklistItemMock.mockResolvedValue({ id: 'new-item' });
    moveChecklistItemToTargetMock.mockClear();
    reorderChecklistItemMock.mockClear();
    useCategoryTagsMock.mockReset();
    useCategoryTagsMock.mockReturnValue([focusTag, homeTag]);
    useChecklistTreeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps a single list until the tab view is chosen in the preferences', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createRow('Loose task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await selectTabView();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'FOCUS',
      'No category',
    ]);
  });

  it('restores the tab view from the stored preference', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createRow('Loose task'),
    ]);

    const { unmount } = render(<ChecklistSurface dailyEntryId="entry-1" />);
    await selectTabView();
    unmount();

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    expect(
      await screen.findByRole('tablist', { name: 'Task categories' }),
    ).toBeInTheDocument();
  });

  it('shows the whole subtree of the root items in the selected tab', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createChildRow('Focus subtask', 'item-Focus task'),
      createRow('Home task', { categoryTagId: 'home' }),
      createRow('Loose task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);
    await selectTabView();

    fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));

    expect(screen.getByDisplayValue('Focus task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Focus subtask')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Home task')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Loose task')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'No category' }));

    expect(screen.getByDisplayValue('Loose task')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Focus task')).not.toBeInTheDocument();
  });

  it('omits the uncategorized tab when every root task has a category', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createRow('Home task', { categoryTagId: 'home' }),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);
    await selectTabView();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'FOCUS',
      'HOME',
    ]);
  });

  it('hides the tab strip while no root task has a category', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Loose task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure task actions' }),
    );
    fireEvent.click(
      screen.getByRole('radio', { name: 'Task view: Category tabs' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Loose task')).toBeInTheDocument();
    });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('reorders against the neighbour visible in the active tab', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createRow('Home task', { categoryTagId: 'home' }),
      createRow('Second focus task', { categoryTagId: 'focus' }),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);
    await selectTabView();

    fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));

    const firstRow = screen.getByDisplayValue('Focus task').closest('.group');

    expect(firstRow).not.toBeNull();
    fireEvent.click(
      within(firstRow as HTMLElement).getByRole('button', {
        name: 'Move task down',
      }),
    );

    await waitFor(() => {
      expect(moveChecklistItemToTargetMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Focus task',
        targetItemId: 'item-Second focus task',
        placement: 'after',
      });
    });
    expect(reorderChecklistItemMock).not.toHaveBeenCalled();
  });

  it('creates new root tasks inside the active category tab', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createRow('Loose task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);
    await selectTabView();

    fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    const draftInput = await waitFor(() => {
      const emptyInput = screen
        .getAllByPlaceholderText('Write a task')
        .find((input) => (input as HTMLInputElement).value === '');

      expect(emptyInput).toBeDefined();
      return emptyInput as HTMLElement;
    });
    fireEvent.change(draftInput, { target: { value: 'New focus task' } });
    fireEvent.blur(draftInput);

    await waitFor(() => {
      expect(createChecklistItemMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'New focus task' }),
      );
    });

    const createdId = createChecklistItemMock.mock.calls[0]?.[0].id;

    await waitFor(() => {
      expect(assignChecklistItemCategoryMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: createdId,
        categoryTagId: 'focus',
      });
    });
  });

  it('leaves new root tasks uncategorized on the all tab', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('Focus task', { categoryTagId: 'focus' }),
      createRow('Loose task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);
    await selectTabView();

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    const draftInput = await waitFor(() => {
      const emptyInput = screen
        .getAllByPlaceholderText('Write a task')
        .find((input) => (input as HTMLInputElement).value === '');

      expect(emptyInput).toBeDefined();
      return emptyInput as HTMLElement;
    });
    fireEvent.change(draftInput, { target: { value: 'New loose task' } });
    fireEvent.blur(draftInput);

    await waitFor(() => {
      expect(createChecklistItemMock).toHaveBeenCalledTimes(1);
    });
    expect(assignChecklistItemCategoryMock).not.toHaveBeenCalled();
  });
});
