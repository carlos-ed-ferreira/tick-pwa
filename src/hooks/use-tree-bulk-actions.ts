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
    await Promise.all(
      [...selectedIds].map((itemId) => deleteSelectedItem(itemId)),
    );

    clearSelection();
    setIsBulkDeleteDialogOpen(false);
  }, [clearSelection, deleteSelectedItem, selectedIds]);

  const assignBulkCategory = useCallback(
    async (categoryTagId: string | null) => {
      await Promise.all(
        [...selectedIds].map((itemId) =>
          assignSelectedItemCategory(itemId, categoryTagId),
        ),
      );
    },
    [assignSelectedItemCategory, selectedIds],
  );

  return {
    assignBulkCategory,
    closeBulkDeleteDialog,
    confirmBulkDelete,
    isBulkDeleteDialogOpen,
    openBulkDeleteDialog,
  };
}
