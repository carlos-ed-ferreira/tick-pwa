import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChecklistSurface } from '@/features/checklist/checklist-surface';

const { softDeleteChecklistItemMock, useChecklistTreeMock } = vi.hoisted(
  () => ({
    softDeleteChecklistItemMock: vi.fn().mockResolvedValue(undefined),
    useChecklistTreeMock: vi.fn(),
  }),
);

vi.mock('@/lib/db', () => ({
  assignChecklistItemCategory: vi.fn().mockResolvedValue(undefined),
  createChecklistChild: vi.fn().mockResolvedValue(undefined),
  createChecklistItem: vi.fn().mockResolvedValue(undefined),
  indentChecklistItem: vi.fn().mockResolvedValue(undefined),
  outdentChecklistItem: vi.fn().mockResolvedValue(undefined),
  softDeleteChecklistItem: softDeleteChecklistItemMock,
  toggleChecklistItemChecked: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItemCollapsed: vi.fn().mockResolvedValue(undefined),
  updateChecklistItemText: vi.fn().mockResolvedValue(undefined),
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
        outdentItem: 'Outdent item',
        deleteItem: 'Delete item',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        confirmDeleteItem: 'This item has content. Delete it anyway?',
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

function createRow(text: string) {
  const now = new Date().toISOString();

  return {
    item: {
      id: `item-${text || 'empty'}`,
      scopeId: 'guest:test',
      dailyEntryId: 'entry-1',
      parentId: null,
      text,
      checked: false,
      collapsed: false,
      categoryTagId: null,
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
  };
}

describe('ChecklistSurface delete confirmation', () => {
  beforeEach(() => {
    useChecklistTreeMock.mockReset();
    softDeleteChecklistItemMock.mockClear();
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
});
