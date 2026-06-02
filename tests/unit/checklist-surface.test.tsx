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
  reorderChecklistItemMock,
  softDeleteChecklistItemMock,
  toggleChecklistItemPriorityMock,
  updateChecklistItemTextMock,
  useChecklistTreeMock,
} = vi.hoisted(() => ({
  createChecklistItemMock: vi.fn().mockResolvedValue({ id: 'new-item' }),
  reorderChecklistItemMock: vi.fn().mockResolvedValue(undefined),
  softDeleteChecklistItemMock: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemPriorityMock: vi.fn().mockResolvedValue(undefined),
  updateChecklistItemTextMock: vi.fn().mockResolvedValue(undefined),
  useChecklistTreeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  assignChecklistItemCategory: vi.fn().mockResolvedValue(undefined),
  createChecklistChild: vi.fn().mockResolvedValue(undefined),
  createChecklistItem: createChecklistItemMock,
  indentChecklistItem: vi.fn().mockResolvedValue(undefined),
  outdentChecklistItem: vi.fn().mockResolvedValue(undefined),
  reorderChecklistItem: reorderChecklistItemMock,
  softDeleteChecklistItem: softDeleteChecklistItemMock,
  toggleChecklistItemChecked: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemCollapsed: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemPriority: toggleChecklistItemPriorityMock,
  updateChecklistItemText: updateChecklistItemTextMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      dayEditor: {
        checklist: 'Checklist',
        addItem: 'Add item',
        emptyChecklist: 'Start this day with a checklist item',
        expandItem: 'Expand item',
        collapseItem: 'Collapse item',
        toggleItem: 'Toggle item',
        itemPlaceholder: 'Write a task',
        addChild: 'Add child',
        indentItem: 'Indent item',
        markPriority: 'Mark as priority',
        moveItemDown: 'Move item down',
        moveItemUp: 'Move item up',
        outdentItem: 'Outdent item',
        unmarkPriority: 'Remove priority',
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
    reorderChecklistItemMock.mockClear();
    softDeleteChecklistItemMock.mockClear();
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

    fireEvent.click(screen.getAllByLabelText('Delete item')[0]);

    expect(
      await screen.findByText('This item has content. Delete it anyway?'),
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
      screen.queryByText('This item has content. Delete it anyway?'),
    ).not.toBeInTheDocument();
  });

  it('reorders a row when clicking the move controls', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Important task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getByLabelText('Move item up'));

    await waitFor(() => {
      expect(reorderChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        itemId: 'item-Important task',
        direction: 'up',
      });
    });
  });

  it('toggles item priority from the row controls', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Important task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

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

  it('flushes edited text before creating a sibling with Enter', async () => {
    useChecklistTreeMock.mockReturnValue([createRow('Original task')]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    const input = screen.getByDisplayValue('Original task');
    fireEvent.change(input, { target: { value: 'Edited task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(createChecklistItemMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        dailyEntryId: 'entry-1',
        parentId: null,
        afterItemId: 'item-Original task',
      });
    });
    expect(updateChecklistItemTextMock).toHaveBeenCalledWith({
      scope: {
        id: 'guest:test',
        kind: 'guest',
        ownerId: 'test',
      },
      itemId: 'item-Original task',
      text: 'Edited task',
    });
    expect(
      updateChecklistItemTextMock.mock.invocationCallOrder[0],
    ).toBeLessThan(createChecklistItemMock.mock.invocationCallOrder[0]);
  });

  it('bulk deletes a selected row from selection mode', async () => {
    useChecklistTreeMock.mockReturnValue([
      createRow('First task'),
      createRow('Second task'),
    ]);

    render(<ChecklistSurface dailyEntryId="entry-1" />);

    fireEvent.click(screen.getAllByLabelText('Select item')[0]);
    fireEvent.click(screen.getAllByLabelText('Delete item')[0]);

    expect(
      await screen.findByText('This will delete 1 items. Continue?'),
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
    expect(
      screen.queryByRole('button', { name: 'Clear selection' }),
    ).not.toBeInTheDocument();
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
    fireEvent.click(screen.getAllByLabelText('Delete item')[0]);

    expect(
      await screen.findByText('This will delete 3 items. Continue?'),
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
      boxShadow: 'inset 3px 0 0 0 rgba(245, 158, 11, 0.9)',
    });
    expect(row?.style.backgroundColor).toBe('');
    expect(input.className.includes('font-medium')).toBe(false);
  });
});
