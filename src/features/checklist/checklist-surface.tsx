'use client';

import { useCallback, useMemo } from 'react';
import { TaskTreeEditableRow, TreeListPanel } from '@/components/app';
import { useCategoryTags } from '@/features/categories';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import {
  assignChecklistItemCategory,
  createChecklistChild,
  createChecklistItem,
  indentChecklistItem,
  outdentChecklistItem,
  reorderChecklistItem,
  softDeleteChecklistItem,
  toggleChecklistItemChecked,
  toggleChecklistItemCollapsed,
  toggleChecklistItemPriority,
  updateChecklistItemText,
} from '@/lib/db';
import { createId } from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { VisibleChecklistRow } from './checklist-tree';
import { useChecklistTree } from './use-checklist-tree';

const checklistInputSelector = '[data-checklist-input="true"]';

export function ChecklistSurface({ dailyEntryId }: { dailyEntryId: string }) {
  const { dictionary, scope } = useAppContext();
  const rows = useChecklistTree(scope, dailyEntryId);
  const categoryTags = useCategoryTags(scope, 'calendar');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));
  const visibleItemIds = useMemo(() => rows.map((row) => row.item.id), [rows]);
  const {
    clearSelection,
    isSelected,
    isSelectionMode,
    selectedCount,
    selectedIds,
    toggleSelect,
  } = useTreeSelection(visibleItemIds);

  const deleteSelectedItem = useCallback(
    async (itemId: string) => {
      if (!scope) return;
      await softDeleteChecklistItem({ scope, itemId });
    },
    [scope],
  );
  const assignSelectedItemCategory = useCallback(
    async (itemId: string, categoryTagId: string | null) => {
      if (!scope) return;
      await assignChecklistItemCategory({ scope, itemId, categoryTagId });
    },
    [scope],
  );
  const {
    assignBulkCategory,
    closeBulkDeleteDialog,
    confirmBulkDelete,
    isBulkDeleteDialogOpen,
    openBulkDeleteDialog,
  } = useTreeBulkActions({
    assignSelectedItemCategory,
    clearSelection,
    deleteSelectedItem,
    selectedIds,
  });

  const createRootItem = useCallback(async () => {
    if (!scope) {
      return;
    }

    await createChecklistItem({ scope, dailyEntryId });
  }, [dailyEntryId, scope]);

  if (!scope) {
    return null;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <TreeListPanel
        addLabel={dictionary.dayEditor.addItem}
        bulkDeleteDialog={{
          cancelLabel: dictionary.actions.cancel,
          confirmLabel: dictionary.actions.delete,
          description: dictionary.dayEditor.confirmBulkDeleteItems.replace(
            '{count}',
            String(selectedCount),
          ),
          open: isBulkDeleteDialogOpen,
          title: dictionary.dayEditor.bulkDeleteItems,
          onClose: closeBulkDeleteDialog,
          onConfirm: () => void confirmBulkDelete(),
        }}
        clearSelectionLabel={dictionary.dayEditor.clearSelection}
        emptyLabel={dictionary.dayEditor.emptyChecklist}
        hasRows={rows.length > 0}
        isSelectionMode={isSelectionMode}
        onAddRoot={createRootItem}
        onClearSelection={clearSelection}
        persistenceErrorLabel={dictionary.dayEditor.saveFailed}
      >
        {rows.map((row) => (
          <ChecklistRow
            key={row.item.id}
            categoryTagMap={categoryTagMap}
            dailyEntryId={dailyEntryId}
            isSelected={isSelected(row.item.id)}
            isSelectionMode={isSelectionMode}
            row={row}
            onBulkAssignCategory={assignBulkCategory}
            onBulkDelete={openBulkDeleteDialog}
            onToggleSelect={toggleSelect}
          />
        ))}
      </TreeListPanel>
    </section>
  );
}

function ChecklistRow({
  categoryTagMap,
  dailyEntryId,
  isSelected,
  isSelectionMode,
  row,
  onBulkAssignCategory,
  onBulkDelete,
  onToggleSelect,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  dailyEntryId: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: VisibleChecklistRow;
  onBulkAssignCategory: (categoryTagId: string | null) => Promise<void>;
  onBulkDelete: () => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const { item, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  if (!scope) {
    return null;
  }

  return (
    <TaskTreeEditableRow
      categoryTagId={item.categoryTagId}
      categoryTagMap={categoryTagMap}
      checked={item.checked}
      collapsed={item.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-checklist-input"
      inputSelector={checklistInputSelector}
      isFirstSibling={isFirstSibling}
      isLastSibling={isLastSibling}
      itemId={item.id}
      labels={{
        ...dictionary.dayEditor,
        cancel: dictionary.actions.cancel,
        delete: dictionary.actions.delete,
      }}
      priority={item.priority}
      selection={{
        isSelected,
        isSelectionMode,
        onBulkAssignCategory,
        onBulkDelete,
        onToggle: (shiftKey) => onToggleSelect(item.id, shiftKey),
      }}
      surface="calendar"
      text={item.text}
      onAssignCategory={(categoryTagId) =>
        assignChecklistItemCategory({
          scope,
          itemId: item.id,
          categoryTagId,
        })
      }
      onCreateChild={async () => {
        await createChecklistChild({
          scope,
          dailyEntryId,
          parentItemId: item.id,
        });
      }}
      onCreateSibling={async () => {
        const newItemId = createId();
        const newItem = await createChecklistItem({
          scope,
          dailyEntryId,
          id: newItemId,
          parentId: item.parentId,
          afterItemId: item.id,
        });
        return newItem.id;
      }}
      onDelete={() => softDeleteChecklistItem({ scope, itemId: item.id })}
      onIndent={() => indentChecklistItem({ scope, itemId: item.id })}
      onMoveDown={() =>
        reorderChecklistItem({
          scope,
          itemId: item.id,
          direction: 'down',
        })
      }
      onMoveUp={() =>
        reorderChecklistItem({
          scope,
          itemId: item.id,
          direction: 'up',
        })
      }
      onOutdent={() => outdentChecklistItem({ scope, itemId: item.id })}
      onSaveText={(text) =>
        updateChecklistItemText({ scope, itemId: item.id, text })
      }
      onToggleChecked={() =>
        toggleChecklistItemChecked({ scope, itemId: item.id })
      }
      onToggleCollapsed={() =>
        toggleChecklistItemCollapsed({ scope, itemId: item.id })
      }
      onTogglePriority={() =>
        toggleChecklistItemPriority({ scope, itemId: item.id })
      }
    />
  );
}
