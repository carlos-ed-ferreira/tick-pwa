'use client';

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { TaskTreeEditableRow, TreeListPanel } from '@/components/app';
import { useCategoryTags } from '@/features/categories';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import type { AppScopeId, ChecklistItem } from '@/lib/domain';
import {
  assignChecklistItemCategory,
  createChecklistItem,
  indentChecklistItem,
  setChecklistItemsChecked,
  outdentChecklistItem,
  reorderChecklistItem,
  softDeleteChecklistItem,
  toggleChecklistItemChecked,
  toggleChecklistItemCollapsed,
  toggleChecklistItemPriority,
  updateChecklistItemScheduledTime,
  updateChecklistItemText,
} from '@/lib/db';
import { createId } from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { VisibleChecklistRow } from './checklist-tree';
import { useChecklistTree } from './use-checklist-tree';

const checklistInputSelector = '[data-checklist-input="true"]';

interface ChecklistDraftItem extends ChecklistItem {
  isDraft: true;
  afterItemId: string | null;
  isPersisting?: boolean;
}

type ChecklistSurfaceRow = VisibleChecklistRow & {
  item: VisibleChecklistRow['item'] | ChecklistDraftItem;
};

function createChecklistDraftItem({
  dailyEntryId,
  parentId,
  scopeId,
  afterItemId = null,
}: {
  dailyEntryId: string;
  parentId: string | null;
  scopeId: AppScopeId;
  afterItemId?: string | null;
}): ChecklistDraftItem {
  const now = new Date().toISOString();

  return {
    id: createId(),
    scopeId,
    dailyEntryId,
    parentId,
    text: '',
    scheduledTime: null,
    checked: false,
    priority: false,
    collapsed: false,
    categoryTagId: null,
    sortRank: 'draft',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: now,
    isDraft: true,
    afterItemId,
  };
}

function findRowSubtreeEndIndex(
  rows: ChecklistSurfaceRow[],
  startIndex: number,
): number {
  const startDepth = rows[startIndex]?.depth ?? 0;
  let index = startIndex + 1;

  while (index < rows.length && rows[index].depth > startDepth) {
    index += 1;
  }

  return index;
}

function insertChecklistDraftRow(
  currentRows: ChecklistSurfaceRow[],
  draft: ChecklistDraftItem,
): ChecklistSurfaceRow[] {
  const nextRows = [...currentRows];

  if (nextRows.some((row) => row.item.id === draft.id)) {
    return nextRows;
  }

  if (draft.parentId === null && draft.afterItemId === null) {
    return nextRows.concat({
      item: draft,
      depth: 0,
      childCount: 0,
      hasChildren: false,
      isFirstSibling: nextRows.filter((row) => row.depth === 0).length === 0,
      isLastSibling: true,
    });
  }

  if (draft.afterItemId) {
    let previousSiblingIndex = -1;

    for (const [index, row] of nextRows.entries()) {
      const rowItem = row.item;

      if (
        rowItem.id === draft.afterItemId ||
        ('isDraft' in rowItem &&
          rowItem.afterItemId === draft.afterItemId &&
          rowItem.parentId === draft.parentId)
      ) {
        previousSiblingIndex = index;
      }
    }

    if (previousSiblingIndex !== -1) {
      const previousSibling = nextRows[previousSiblingIndex];

      nextRows.splice(
        findRowSubtreeEndIndex(nextRows, previousSiblingIndex),
        0,
        {
          item: draft,
          depth: previousSibling.depth,
          childCount: 0,
          hasChildren: false,
          isFirstSibling: false,
          isLastSibling: previousSibling.isLastSibling,
        },
      );

      return nextRows;
    }
  }

  if (draft.parentId) {
    const parentIndex = nextRows.findIndex(
      (row) => row.item.id === draft.parentId,
    );

    if (parentIndex !== -1) {
      const parentRow = nextRows[parentIndex];
      const insertIndex = findRowSubtreeEndIndex(nextRows, parentIndex);

      nextRows.splice(insertIndex, 0, {
        item: draft,
        depth: parentRow.depth + 1,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: !parentRow.hasChildren,
        isLastSibling: true,
      });
    }
  }

  return nextRows;
}

function insertChecklistDraftRows(
  rows: VisibleChecklistRow[],
  drafts: ChecklistDraftItem[],
): ChecklistSurfaceRow[] {
  const persistedIds = new Set(rows.map((row) => row.item.id));
  const pendingDrafts = drafts.filter((draft) => !persistedIds.has(draft.id));

  return pendingDrafts.reduce<ChecklistSurfaceRow[]>(
    (currentRows, draft) => insertChecklistDraftRow(currentRows, draft),
    rows.map((row) => ({ ...row })) as ChecklistSurfaceRow[],
  );
}

export function ChecklistSurface({ dailyEntryId }: { dailyEntryId: string }) {
  const { dictionary, scope } = useAppContext();
  const rows = useChecklistTree(scope, dailyEntryId);
  const [draftItems, setDraftItems] = useState<ChecklistDraftItem[]>([]);
  const categoryTags = useCategoryTags(scope, 'checklist_item');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));
  const displayRows = useMemo(
    () => insertChecklistDraftRows(rows, draftItems),
    [draftItems, rows],
  );
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
      return null;
    }

    const nextDraft = createChecklistDraftItem({
      dailyEntryId,
      parentId: null,
      scopeId: scope.id,
    });
    setDraftItems((currentDrafts) => [...currentDrafts, nextDraft]);
    return nextDraft.id;
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
        hasRows={displayRows.length > 0}
        isSelectionMode={isSelectionMode}
        onAddRoot={createRootItem}
        onClearSelection={clearSelection}
      >
        {displayRows.map((row) => (
          <ChecklistRow
            key={row.item.id}
            categoryTagMap={categoryTagMap}
            dailyEntryId={dailyEntryId}
            isSelected={isSelected(row.item.id)}
            isSelectionMode={isSelectionMode}
            row={row}
            rows={displayRows}
            onBulkAssignCategory={assignBulkCategory}
            onBulkDelete={openBulkDeleteDialog}
            onBulkToggleChecked={async (nextChecked) => {
              if (!scope) {
                return;
              }

              await setChecklistItemsChecked({
                scope,
                itemIds: [...selectedIds],
                checked: nextChecked,
              });
            }}
            onToggleSelect={toggleSelect}
            setDraftItems={setDraftItems}
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
  rows,
  onBulkAssignCategory,
  onBulkDelete,
  onBulkToggleChecked,
  onToggleSelect,
  setDraftItems,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  dailyEntryId: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: ChecklistSurfaceRow;
  rows: ChecklistSurfaceRow[];
  onBulkAssignCategory: (categoryTagId: string | null) => Promise<void>;
  onBulkDelete: () => void;
  onBulkToggleChecked: (nextChecked: boolean) => Promise<void>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  setDraftItems: Dispatch<SetStateAction<ChecklistDraftItem[]>>;
}) {
  const { dictionary, scope } = useAppContext();
  const { item, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  if (!scope) {
    return null;
  }

  const isDraft = 'isDraft' in item && item.isDraft;

  async function moveItemToTarget({
    itemId,
    targetItemId,
    placement,
  }: {
    itemId: string;
    targetItemId: string;
    placement: 'before' | 'after';
  }) {
    if (!scope || itemId === targetItemId) {
      return;
    }

    const draggedRow = rows.find((currentRow) => currentRow.item.id === itemId);
    const targetRow = rows.find(
      (currentRow) => currentRow.item.id === targetItemId,
    );

    if (!draggedRow || !targetRow) {
      return;
    }

    if (draggedRow.item.parentId !== targetRow.item.parentId) {
      return;
    }

    const siblings = rows.filter(
      (currentRow) => currentRow.item.parentId === targetRow.item.parentId,
    );
    const currentIndex = siblings.findIndex(
      (currentRow) => currentRow.item.id === itemId,
    );
    const targetIndex = siblings.findIndex(
      (currentRow) => currentRow.item.id === targetItemId,
    );

    if (currentIndex === -1 || targetIndex === -1) {
      return;
    }

    let nextIndex = placement === 'before' ? targetIndex : targetIndex + 1;

    if (currentIndex < nextIndex) {
      nextIndex -= 1;
    }

    if (nextIndex === currentIndex) {
      return;
    }

    const direction = nextIndex > currentIndex ? 'down' : 'up';
    const steps = Math.abs(nextIndex - currentIndex);

    for (let index = 0; index < steps; index += 1) {
      await reorderChecklistItem({ scope, itemId, direction });
    }
  }

  async function persistDraftItem(text: string) {
    if (!isDraft || !scope) {
      return;
    }

    if (item.isPersisting) {
      return;
    }

    setDraftItems((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === item.id ? { ...draft, text, isPersisting: true } : draft,
      ),
    );

    try {
      await createChecklistItem({
        scope,
        dailyEntryId,
        id: item.id,
        parentId: item.parentId,
        afterItemId: item.afterItemId,
        scheduledTime: item.scheduledTime,
        text,
      });
    } catch (error) {
      setDraftItems((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.id === item.id ? { ...draft, isPersisting: false } : draft,
        ),
      );
      throw error;
    }
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
      scheduledTime={item.scheduledTime}
      selection={{
        isSelected,
        isSelectionMode,
        onBulkAssignCategory,
        onBulkDelete,
        onBulkToggleChecked,
        onToggle: (shiftKey) => onToggleSelect(item.id, shiftKey),
      }}
      surface="checklist_item"
      text={item.text}
      showScheduledTime={true}
      isDraft={isDraft}
      onAssignCategory={(categoryTagId) =>
        assignChecklistItemCategory({
          scope,
          itemId: item.id,
          categoryTagId,
        })
      }
      onCreateChild={async () => {
        const newDraft = createChecklistDraftItem({
          dailyEntryId,
          parentId: item.id,
          scopeId: scope.id,
        });
        setDraftItems((currentDrafts) => [...currentDrafts, newDraft]);
        return newDraft.id;
      }}
      onCreateSibling={async () => {
        const newDraft = createChecklistDraftItem({
          dailyEntryId,
          parentId: item.parentId,
          scopeId: scope.id,
          afterItemId: item.id,
        });
        setDraftItems((currentDrafts) => [...currentDrafts, newDraft]);
        return newDraft.id;
      }}
      onDelete={() =>
        isDraft
          ? setDraftItems((currentDrafts) =>
              currentDrafts.filter((draft) => draft.id !== item.id),
            )
          : softDeleteChecklistItem({ scope, itemId: item.id })
      }
      onIndent={() => indentChecklistItem({ scope, itemId: item.id })}
      onMoveDown={() =>
        reorderChecklistItem({
          scope,
          itemId: item.id,
          direction: 'down',
        })
      }
      onMoveTo={moveItemToTarget}
      onMoveUp={() =>
        reorderChecklistItem({
          scope,
          itemId: item.id,
          direction: 'up',
        })
      }
      onOutdent={() => outdentChecklistItem({ scope, itemId: item.id })}
      onSaveText={(text) =>
        isDraft
          ? persistDraftItem(text)
          : updateChecklistItemText({ scope, itemId: item.id, text })
      }
      onSaveTime={(scheduledTime) =>
        isDraft
          ? setDraftItems((currentDrafts) =>
              currentDrafts.map((draft) =>
                draft.id === item.id ? { ...draft, scheduledTime } : draft,
              ),
            )
          : updateChecklistItemScheduledTime({
              scope,
              itemId: item.id,
              scheduledTime,
            })
      }
      onToggleChecked={() =>
        isDraft
          ? Promise.resolve()
          : toggleChecklistItemChecked({ scope, itemId: item.id })
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
