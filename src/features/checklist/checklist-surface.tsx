'use client';

import { Clock3 } from 'lucide-react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  moveTreeItemToTarget,
  TaskTreeBulkActions,
  TaskTreeEditableRow,
  TaskTreeRowActionsMenu,
  TreeListPanel,
  type TaskTreeRowActionPreferences,
} from '@/components/app';
import { IconButton } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import { useTaskTreeRowActionPreferences } from '@/hooks/use-task-tree-row-action-visibility';
import type {
  AppScopeId,
  ChecklistItem,
  TaskCompletionValues,
} from '@/lib/domain';
import {
  assignChecklistItemCategory,
  createChecklistItem,
  indentChecklistItem,
  moveChecklistItemToParent,
  moveChecklistItemToTarget,
  setChecklistItemsChecked,
  outdentChecklistItem,
  reorderChecklistItem,
  reorderChecklistItemsByScheduledTime,
  softDeleteChecklistItem,
  toggleChecklistItemBold,
  toggleChecklistItemChecked,
  toggleChecklistItemCollapsed,
  toggleChecklistItemPriority,
  updateChecklistItemScheduledTime,
  updateChecklistItemText,
} from '@/lib/db';
import { createId } from '@/lib/domain';
import { formatCountLabel, formatSelectionLabel } from '@/lib/i18n';
import { useAppContext } from '@/providers';
import type { VisibleChecklistRow } from './checklist-tree';
import { useChecklistTree } from './use-checklist-tree';

const checklistInputSelector = '[data-checklist-input="true"]';

interface ChecklistDraftItem extends ChecklistItem {
  beforeItemId: string | null;
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
    ignored: false,
    bold: false,
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
    beforeItemId: null,
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

  if (draft.beforeItemId) {
    const nextSiblingIndex = nextRows.findIndex(
      (row) => row.item.id === draft.beforeItemId,
    );

    if (nextSiblingIndex !== -1) {
      const nextSibling = nextRows[nextSiblingIndex];
      nextRows.splice(nextSiblingIndex, 0, {
        item: draft,
        depth: nextSibling.depth,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: nextSibling.isFirstSibling,
        isLastSibling: false,
      });
      return nextRows;
    }
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
      const isFirstChild = !parentRow.hasChildren;

      nextRows[parentIndex] = {
        ...parentRow,
        childCount: parentRow.childCount + 1,
        hasChildren: true,
      };

      if (parentRow.item.collapsed) {
        return nextRows;
      }

      const insertIndex = findRowSubtreeEndIndex(nextRows, parentIndex);

      nextRows.splice(insertIndex, 0, {
        item: draft,
        depth: parentRow.depth + 1,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: isFirstChild,
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

function collectDeletedChecklistRowIds(
  rows: ChecklistSurfaceRow[],
  itemId: string,
): Set<string> {
  const deletedIds = new Set<string>();
  const startIndex = rows.findIndex((row) => row.item.id === itemId);

  if (startIndex === -1) {
    deletedIds.add(itemId);
    return deletedIds;
  }

  const rootDepth = rows[startIndex].depth;

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];

    if (index > startIndex && row.depth <= rootDepth) {
      break;
    }

    deletedIds.add(row.item.id);
  }

  return deletedIds;
}

function pruneChecklistDraftItems(
  drafts: ChecklistDraftItem[],
  deletedIds: ReadonlySet<string>,
): ChecklistDraftItem[] {
  const prunedIds = collectPrunedChecklistDraftIds(drafts, deletedIds);

  return drafts.filter((draft) => !prunedIds.has(draft.id));
}

function collectPrunedChecklistDraftIds(
  drafts: ChecklistDraftItem[],
  deletedIds: ReadonlySet<string>,
): Set<string> {
  const prunedIds = new Set(deletedIds);
  let didAddPrunedDraft = true;

  while (didAddPrunedDraft) {
    didAddPrunedDraft = false;

    for (const draft of drafts) {
      if (
        !prunedIds.has(draft.id) &&
        (prunedIds.has(draft.parentId ?? '') ||
          prunedIds.has(draft.afterItemId ?? '') ||
          prunedIds.has(draft.beforeItemId ?? ''))
      ) {
        prunedIds.add(draft.id);
        didAddPrunedDraft = true;
      }
    }
  }

  return new Set(
    drafts.filter((draft) => prunedIds.has(draft.id)).map((draft) => draft.id),
  );
}

export function ChecklistSurface({ dailyEntryId }: { dailyEntryId: string }) {
  const { dictionary, scope } = useAppContext();
  const rows = useChecklistTree(scope, dailyEntryId);
  const [draftItems, setDraftItems] = useState<ChecklistDraftItem[]>([]);
  const { actionPreferences, setActionPreferences } =
    useTaskTreeRowActionPreferences('checklist_item');
  const deletedDraftItemIdsRef = useRef(new Set<string>());
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
      const deletedIds = collectDeletedChecklistRowIds(displayRows, itemId);
      const prunedDraftIds = collectPrunedChecklistDraftIds(
        draftItems,
        deletedIds,
      );
      for (const draftId of prunedDraftIds) {
        deletedDraftItemIdsRef.current.add(draftId);
      }

      await softDeleteChecklistItem({ scope, itemId });
      await Promise.all(
        [...prunedDraftIds].map((draftId) =>
          softDeleteChecklistItem({ scope, itemId: draftId }),
        ),
      );
      setDraftItems((currentDrafts) =>
        pruneChecklistDraftItems(currentDrafts, deletedIds),
      );
    },
    [displayRows, draftItems, scope],
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
  const selectedItems = rows
    .map((row) => row.item)
    .filter((item) => selectedIds.has(item.id));
  const allSelectedPriority =
    selectedItems.length > 0 && selectedItems.every((item) => item.priority);
  const allSelectedBold =
    selectedItems.length > 0 && selectedItems.every((item) => item.bold);
  const selectedLabel = formatSelectionLabel({
    count: selectedCount,
    plural: dictionary.dayEditor.itemsSelected,
    singular: dictionary.dayEditor.itemSelected,
  });

  if (!scope) {
    return null;
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <TreeListPanel
        addLabel={dictionary.dayEditor.addItem}
        surface="none"
        bulkDeleteDialog={{
          cancelLabel: dictionary.actions.cancel,
          confirmLabel: dictionary.actions.delete,
          description: formatCountLabel({
            count: selectedCount,
            plural: dictionary.dayEditor.confirmBulkDeleteItems,
            singular: dictionary.dayEditor.confirmBulkDeleteItem,
          }),
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
        selectionActions={
          <TaskTreeBulkActions
            actionPreferences={actionPreferences}
            allBold={allSelectedBold}
            allPriority={allSelectedPriority}
            labels={{
              bold: dictionary.dayEditor.bulkBold,
              category: dictionary.dayEditor.bulkCategory,
              clearCategory: dictionary.dayEditor.clearCategory,
              delete: dictionary.dayEditor.bulkDelete,
              priority: dictionary.dayEditor.bulkPriority,
              selected: selectedLabel,
            }}
            surface="checklist_item"
            onAssignCategory={assignBulkCategory}
            onDelete={openBulkDeleteDialog}
            onToggleBold={async () => {
              const nextBold = !allSelectedBold;
              await Promise.all(
                selectedItems
                  .filter((item) => item.bold !== nextBold)
                  .map((item) =>
                    toggleChecklistItemBold({ scope, itemId: item.id }),
                  ),
              );
            }}
            onTogglePriority={async () => {
              const nextPriority = !allSelectedPriority;
              await Promise.all(
                selectedItems
                  .filter((item) => item.priority !== nextPriority)
                  .map((item) =>
                    toggleChecklistItemPriority({ scope, itemId: item.id }),
                  ),
              );
            }}
          />
        }
        toolbarActions={
          <>
            <IconButton
              aria-label={dictionary.calendar.sortByTime}
              title={dictionary.calendar.sortByTime}
              className="rounded-full border border-white/10 bg-white/5 text-[#bdb4d4] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              onClick={() =>
                void reorderChecklistItemsByScheduledTime({
                  scope,
                  dailyEntryId,
                })
              }
            >
              <Clock3 aria-hidden="true" className="size-4" />
            </IconButton>
            <TaskTreeRowActionsMenu
              labels={{
                actions: {
                  add: dictionary.dayEditor.addChild,
                  bold: dictionary.dayEditor.bulkBold,
                  category: dictionary.dayEditor.bulkCategory,
                  clearCategory: dictionary.dayEditor.clearCategory,
                  delete: dictionary.dayEditor.bulkDelete,
                  drag: dictionary.dayEditor.dragAndDrop,
                  indent: dictionary.dayEditor.indentItem,
                  moveDown: dictionary.dayEditor.moveItemDown,
                  moveUp: dictionary.dayEditor.moveItemUp,
                  outdent: dictionary.dayEditor.outdentItem,
                  priority: dictionary.dayEditor.bulkPriority,
                  scheduledTime: dictionary.dayEditor.itemTime,
                },
                close: dictionary.actions.cancel,
                configure: dictionary.dayEditor.configureRowActions,
                hidden: dictionary.dayEditor.actionHidden,
                inline: dictionary.dayEditor.actionOnRow,
                menu: dictionary.dayEditor.actionInMenu,
                reset: dictionary.dayEditor.resetRowActions,
                title: dictionary.dayEditor.rowActionsTitle,
                visible: dictionary.dayEditor.actionVisible,
              }}
              value={actionPreferences}
              onChange={setActionPreferences}
            />
          </>
        }
      >
        {displayRows.map((row) => (
          <ChecklistRow
            key={row.item.id}
            actionPreferences={actionPreferences}
            categoryTagMap={categoryTagMap}
            dailyEntryId={dailyEntryId}
            deletedDraftItemIdsRef={deletedDraftItemIdsRef}
            isSelected={isSelected(row.item.id)}
            isSelectionMode={isSelectionMode}
            row={row}
            rows={displayRows}
            onBulkAssignCategory={assignBulkCategory}
            onBulkDelete={openBulkDeleteDialog}
            onBulkToggleChecked={async (nextValues) => {
              if (!scope) {
                return;
              }

              await setChecklistItemsChecked({
                scope,
                itemIds: [...selectedIds],
                checked: nextValues.completed,
                ignored: nextValues.ignored,
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
  actionPreferences,
  categoryTagMap,
  dailyEntryId,
  deletedDraftItemIdsRef,
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
  actionPreferences: TaskTreeRowActionPreferences;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  dailyEntryId: string;
  deletedDraftItemIdsRef: MutableRefObject<Set<string>>;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: ChecklistSurfaceRow;
  rows: ChecklistSurfaceRow[];
  onBulkAssignCategory: (categoryTagId: string | null) => Promise<void>;
  onBulkDelete: () => void;
  onBulkToggleChecked: (nextValues: TaskCompletionValues) => Promise<void>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  setDraftItems: Dispatch<SetStateAction<ChecklistDraftItem[]>>;
}) {
  const { dictionary, scope } = useAppContext();
  const { item, depth, hasChildren } = row;
  if (!scope) {
    return null;
  }

  const isDraft = 'isDraft' in item && item.isDraft;
  const siblingIds = rows
    .filter((currentRow) => currentRow.item.parentId === item.parentId)
    .map((currentRow) => currentRow.item.id);
  const siblingIndex = siblingIds.indexOf(item.id);
  const isFirstVisibleSibling = siblingIndex === 0;
  const isLastVisibleSibling = siblingIndex === siblingIds.length - 1;

  async function moveItemToTarget({
    itemId,
    targetItemId,
    placement,
  }: {
    itemId: string;
    targetItemId: string;
    placement: 'before' | 'child' | 'after';
  }) {
    if (!scope) {
      return;
    }

    const movingItem = rows.find((row) => row.item.id === itemId)?.item;
    const targetItem = rows.find((row) => row.item.id === targetItemId)?.item;

    if (
      movingItem &&
      'isDraft' in movingItem &&
      movingItem.isDraft &&
      targetItem
    ) {
      const targetAncestors = new Set<string>();
      let currentParentId = targetItem.parentId;

      while (currentParentId) {
        targetAncestors.add(currentParentId);
        currentParentId =
          rows.find((row) => row.item.id === currentParentId)?.item.parentId ??
          null;
      }

      if (placement === 'child' && targetAncestors.has(itemId)) {
        return;
      }

      setDraftItems((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.id !== itemId
            ? draft
            : placement === 'child'
              ? {
                  ...draft,
                  afterItemId: null,
                  beforeItemId: null,
                  parentId: targetItemId,
                }
              : {
                  ...draft,
                  afterItemId: placement === 'after' ? targetItemId : null,
                  beforeItemId: placement === 'before' ? targetItemId : null,
                  parentId: targetItem.parentId,
                },
        ),
      );
      return;
    }

    await moveTreeItemToTarget({
      canMove: (candidate) => !('isDraft' in candidate && candidate.isDraft),
      itemId,
      items: rows.map((currentRow) => currentRow.item),
      placement,
      targetItemId,
      onMoveAsChild: (movingItemId, parentItemId) =>
        moveChecklistItemToParent({
          scope,
          itemId: movingItemId,
          parentItemId,
        }),
      onMoveAdjacent: (movingItemId, targetItemId, placement) =>
        moveChecklistItemToTarget({
          scope,
          itemId: movingItemId,
          targetItemId,
          placement,
        }),
      onReorder: (movingItemId, direction) =>
        reorderChecklistItem({ scope, itemId: movingItemId, direction }),
    });
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
        bold: item.bold,
        text,
      });

      if (item.beforeItemId) {
        await moveChecklistItemToTarget({
          scope,
          itemId: item.id,
          targetItemId: item.beforeItemId,
          placement: 'before',
        });
      }

      if (deletedDraftItemIdsRef.current.has(item.id)) {
        await softDeleteChecklistItem({ scope, itemId: item.id });
      }
    } catch (error) {
      setDraftItems((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.id === item.id ? { ...draft, isPersisting: false } : draft,
        ),
      );
      throw error;
    }
  }

  function indentItem() {
    if (!scope) {
      return;
    }

    if (!isDraft) {
      return indentChecklistItem({ scope, itemId: item.id });
    }

    const currentSiblingIndex = siblingIds.indexOf(item.id);
    const previousSiblingId = siblingIds[currentSiblingIndex - 1];

    if (!previousSiblingId) {
      return;
    }

    return moveItemToTarget({
      itemId: item.id,
      placement: 'child',
      targetItemId: previousSiblingId,
    });
  }

  function outdentItem() {
    if (!scope) {
      return;
    }

    if (!isDraft) {
      return outdentChecklistItem({ scope, itemId: item.id });
    }

    if (!item.parentId) {
      return;
    }

    return moveItemToTarget({
      itemId: item.id,
      placement: 'after',
      targetItemId: item.parentId,
    });
  }

  function moveItem(direction: 'down' | 'up') {
    if (!scope) {
      return;
    }

    const targetItemId =
      siblingIds[siblingIndex + (direction === 'up' ? -1 : 1)];

    if (!targetItemId) {
      return;
    }

    const targetItem = rows.find(
      (currentRow) => currentRow.item.id === targetItemId,
    )?.item;

    if (isDraft) {
      return moveItemToTarget({
        itemId: item.id,
        placement: direction === 'up' ? 'before' : 'after',
        targetItemId,
      });
    }

    if (targetItem && 'isDraft' in targetItem && targetItem.isDraft) {
      return moveItemToTarget({
        itemId: targetItem.id,
        placement: direction === 'up' ? 'after' : 'before',
        targetItemId: item.id,
      });
    }

    return reorderChecklistItem({ scope, itemId: item.id, direction });
  }

  function toggleCollapsed() {
    if (!scope) {
      return;
    }

    if (!isDraft) {
      return toggleChecklistItemCollapsed({ scope, itemId: item.id });
    }

    setDraftItems((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === item.id
          ? { ...draft, collapsed: !draft.collapsed }
          : draft,
      ),
    );
  }

  return (
    <TaskTreeEditableRow
      actionPreferences={actionPreferences}
      bold={item.bold}
      categoryTagId={item.categoryTagId}
      categoryTagMap={categoryTagMap}
      checked={item.checked}
      ignored={item.ignored}
      collapsed={item.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-checklist-input"
      inputSelector={checklistInputSelector}
      isFirstSibling={isFirstVisibleSibling}
      isLastSibling={isLastVisibleSibling}
      itemId={item.id}
      labels={{
        ...dictionary.dayEditor,
        cancel: dictionary.actions.cancel,
        delete: dictionary.actions.delete,
      }}
      parentId={item.parentId}
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
      siblingIds={siblingIds}
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
          : (async () => {
              const deletedIds = collectDeletedChecklistRowIds(rows, item.id);
              const prunedDraftIds = collectPrunedChecklistDraftIds(
                rows
                  .map((currentRow) => currentRow.item)
                  .filter(
                    (currentItem): currentItem is ChecklistDraftItem =>
                      'isDraft' in currentItem && currentItem.isDraft,
                  ),
                deletedIds,
              );
              for (const draftId of prunedDraftIds) {
                deletedDraftItemIdsRef.current.add(draftId);
              }

              await softDeleteChecklistItem({ scope, itemId: item.id });
              await Promise.all(
                [...prunedDraftIds].map((draftId) =>
                  softDeleteChecklistItem({ scope, itemId: draftId }),
                ),
              );
              setDraftItems((currentDrafts) =>
                pruneChecklistDraftItems(currentDrafts, deletedIds),
              );
            })()
      }
      onIndent={indentItem}
      onMoveTo={moveItemToTarget}
      onMoveDown={() => moveItem('down')}
      onMoveUp={() => moveItem('up')}
      onOutdent={outdentItem}
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
      onToggleBold={() =>
        isDraft
          ? setDraftItems((currentDrafts) =>
              currentDrafts.map((draft) =>
                draft.id === item.id ? { ...draft, bold: !draft.bold } : draft,
              ),
            )
          : toggleChecklistItemBold({ scope, itemId: item.id })
      }
      onToggleCollapsed={toggleCollapsed}
      onTogglePriority={() =>
        toggleChecklistItemPriority({ scope, itemId: item.id })
      }
    />
  );
}
