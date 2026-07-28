import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChecklistSurface } from '@/features/checklist/checklist-surface';

const {
  createChecklistItemMock,
  moveChecklistItemToParentMock,
  reorderChecklistItemMock,
  setChecklistItemsCheckedMock,
  softDeleteChecklistItemMock,
  toggleChecklistItemBoldMock,
  toggleChecklistItemPriorityMock,
  updateChecklistItemScheduledTimeMock,
  updateChecklistItemTextMock,
  useChecklistTreeMock,
} = vi.hoisted(() => ({
  createChecklistItemMock: vi.fn().mockResolvedValue({ id: 'new-item' }),
  moveChecklistItemToParentMock: vi.fn().mockResolvedValue(undefined),
  reorderChecklistItemMock: vi.fn().mockResolvedValue(undefined),
  setChecklistItemsCheckedMock: vi.fn().mockResolvedValue(undefined),
  softDeleteChecklistItemMock: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemBoldMock: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemPriorityMock: vi.fn().mockResolvedValue(undefined),
  updateChecklistItemScheduledTimeMock: vi.fn().mockResolvedValue(undefined),
  updateChecklistItemTextMock: vi.fn().mockResolvedValue(undefined),
  useChecklistTreeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  assignChecklistItemCategory: vi.fn().mockResolvedValue(undefined),
  createChecklistChild: vi.fn().mockResolvedValue(undefined),
  createChecklistItem: createChecklistItemMock,
  indentChecklistItem: vi.fn().mockResolvedValue(undefined),
  moveChecklistItemToParent: moveChecklistItemToParentMock,
  outdentChecklistItem: vi.fn().mockResolvedValue(undefined),
  reorderChecklistItem: reorderChecklistItemMock,
  setChecklistItemsChecked: setChecklistItemsCheckedMock,
  softDeleteChecklistItem: softDeleteChecklistItemMock,
  toggleChecklistItemChecked: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemBold: toggleChecklistItemBoldMock,
  toggleChecklistItemCollapsed: vi.fn().mockResolvedValue(undefined),
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
      dayEditor: {
        addItem: 'Add item',
        emptyChecklist: 'Start this day with a checklist item',
        expandItem: 'Expand item',
        collapseItem: 'Collapse item',
        toggleItem: 'Toggle item',
        itemPlaceholder: 'Write a task',
        addChild: 'Add child',
        indentItem: 'Indent item',
        dragItem: 'Drag item',
        itemTime: 'Task time',
        markPriority: 'Mark as priority',
        moveItemDown: 'Move item down',
        moveItemUp: 'Move item up',
        moreActions: 'More actions',
        outdentItem: 'Outdent item',
        unmarkPriority: 'Remove priority',
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
        bulkPriority: 'Priority',
        bulkBold: 'Bold',
        bulkCategory: 'Category',
        bulkDelete: 'Delete',
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
  useCategoryTags: () => [],
}));

vi.mock('@/features/checklist/use-checklist-tree', () => ({
  useChecklistTree: useChecklistTreeMock,
}));

function createRow(
  text: string,
  overrides: Partial<{ priority: boolean; categoryTagId: string | null }> = {},
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
      checked: false,
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
  beforeEach(() => {
    useChecklistTreeMock.mockReset();
    createChecklistItemMock.mockClear();
    createChecklistItemMock.mockResolvedValue({ id: 'new-item' });
    moveChecklistItemToParentMock.mockClear();
    reorderChecklistItemMock.mockClear();
    setChecklistItemsCheckedMock.mockClear();
    softDeleteChecklistItemMock.mockClear();
    toggleChecklistItemBoldMock.mockClear();
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
    fireEvent.click(screen.getAllByLabelText('Delete item')[0]);

    expect(
      await screen.findByText('Are you sure you want to delete this item?'),
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
    fireEvent.click(screen.getAllByLabelText('Delete item')[0]);

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
      screen.queryByText('Are you sure you want to delete this item?'),
    ).not.toBeInTheDocument();
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
    const firstHandle = screen.getAllByLabelText('Drag item')[0];
    const secondRow = screen.getByDisplayValue('Second task').closest('.group');

    expect(secondRow).not.toBeNull();

    fireEvent.dragStart(firstHandle, { dataTransfer });
    fireEvent.drop(secondRow as Element, {
      clientY: 999,
      dataTransfer,
    });

    await waitFor(() => {
      expect(reorderChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-First task',
        direction: 'down',
      });
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
    const childHandle = screen.getAllByLabelText('Drag item')[1];
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
    const draftHandle = screen.getAllByLabelText('Drag item')[1];
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
        name: 'Start this day with a checklist item',
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

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

    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setChecklistItemsCheckedMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemIds: ['item-First task'],
        checked: true,
      });
    });
  });

  it('shows collective actions beside the global add button and applies bold to every selected row', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const selectionButtons = screen.getAllByLabelText('Select item');
    fireEvent.click(selectionButtons[0]);
    fireEvent.click(selectionButtons[1]);
    const addButton = screen.getByRole('button', { name: 'Add item' });
    const bulkBold = screen.getByRole('button', {
      name: 'Bold · 2 selected',
    });

    expect(bulkBold.closest('[data-tree-selection-actions]')).toBe(
      addButton.parentElement?.querySelector('[data-tree-selection-actions]'),
    );

    fireEvent.click(bulkBold);
    fireEvent.click(
      screen.getByRole('button', { name: 'Priority · 2 selected' }),
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

  it('bulk deletes a selected row from selection mode', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 selected' }),
    );

    expect(
      await screen.findByText('Are you sure you want to delete this item?'),
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
    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 selected' }),
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

    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(screen.getAllByLabelText('Select item')[1], {
      shiftKey: true,
    });
    fireEvent.click(
      screen.getByRole('button', { name: /^Delete · \d+ selected$/ }),
    );

    expect(
      await screen.findByText('Are you sure you want to delete this item?'),
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
      boxShadow: 'inset 4px 0 0 0 rgba(240, 195, 142, 1)',
    });
    expect(row?.style.backgroundColor).toBe('');
    expect(input.className.includes('font-medium')).toBe(false);
  });
});
