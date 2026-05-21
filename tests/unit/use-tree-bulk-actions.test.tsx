import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';

function BulkActionsHarness({
  assignSelectedItemCategory,
  deleteSelectedItem,
}: {
  assignSelectedItemCategory: (
    itemId: string,
    categoryTagId: string | null,
  ) => Promise<void>;
  deleteSelectedItem: (itemId: string) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState(new Set(['one', 'two']));
  const actions = useTreeBulkActions({
    assignSelectedItemCategory,
    clearSelection: () => setSelectedIds(new Set()),
    deleteSelectedItem,
    selectedIds,
  });

  return (
    <div>
      <output data-testid="selected-count">{selectedIds.size}</output>
      <output data-testid="delete-dialog-open">
        {String(actions.isBulkDeleteDialogOpen)}
      </output>
      <button type="button" onClick={actions.openBulkDeleteDialog}>
        open delete
      </button>
      <button type="button" onClick={() => void actions.confirmBulkDelete()}>
        confirm delete
      </button>
      <button
        type="button"
        onClick={() => void actions.assignBulkCategory('cat')}
      >
        assign category
      </button>
    </div>
  );
}

describe('useTreeBulkActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('deletes selected items and clears the selection', async () => {
    const deleteSelectedItem = vi.fn().mockResolvedValue(undefined);
    const assignSelectedItemCategory = vi.fn().mockResolvedValue(undefined);

    render(
      <BulkActionsHarness
        assignSelectedItemCategory={assignSelectedItemCategory}
        deleteSelectedItem={deleteSelectedItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open delete' }));

    expect(screen.getByTestId('delete-dialog-open')).toHaveTextContent('true');

    fireEvent.click(screen.getByRole('button', { name: 'confirm delete' }));

    await waitFor(() => {
      expect(deleteSelectedItem).toHaveBeenCalledWith('one');
      expect(deleteSelectedItem).toHaveBeenCalledWith('two');
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
      expect(screen.getByTestId('delete-dialog-open')).toHaveTextContent(
        'false',
      );
    });
  });

  it('assigns a category to selected items and clears the selection', async () => {
    const deleteSelectedItem = vi.fn().mockResolvedValue(undefined);
    const assignSelectedItemCategory = vi.fn().mockResolvedValue(undefined);

    render(
      <BulkActionsHarness
        assignSelectedItemCategory={assignSelectedItemCategory}
        deleteSelectedItem={deleteSelectedItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'assign category' }));

    await waitFor(() => {
      expect(assignSelectedItemCategory).toHaveBeenCalledWith('one', 'cat');
      expect(assignSelectedItemCategory).toHaveBeenCalledWith('two', 'cat');
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    });
  });
});
