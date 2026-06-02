'use client';

import { useCallback, useState } from 'react';

export function useTreeBulkActions({
  assignSelectedItemCategory,
  clearSelection,
  deleteSelectedItem,
  selectedIds,
}: {
  assignSelectedItemCategory: (
    itemId: string,
    categoryTagId: string | null,
  ) => Promise<void>;
  clearSelection: () => void;
  deleteSelectedItem: (itemId: string) => Promise<void>;
  selectedIds: ReadonlySet<string>;
}) {
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  const closeBulkDeleteDialog = useCallback(() => {
    setIsBulkDeleteDialogOpen(false);
  }, []);

  const openBulkDeleteDialog = useCallback(() => {
    setIsBulkDeleteDialogOpen(true);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    for (const itemId of selectedIds) {
      await deleteSelectedItem(itemId);
    }

    clearSelection();
    setIsBulkDeleteDialogOpen(false);
  }, [clearSelection, deleteSelectedItem, selectedIds]);

  const assignBulkCategory = useCallback(
    async (categoryTagId: string | null) => {
      for (const itemId of selectedIds) {
        await assignSelectedItemCategory(itemId, categoryTagId);
      }

      clearSelection();
    },
    [assignSelectedItemCategory, clearSelection, selectedIds],
  );

  return {
    assignBulkCategory,
    closeBulkDeleteDialog,
    confirmBulkDelete,
    isBulkDeleteDialogOpen,
    openBulkDeleteDialog,
  };
}
