'use client';

import {
  ArrowDown,
  ArrowUp,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import {
  TaskTreeActionGroup,
  TaskTreeCategoryChip,
  TaskTreeCollapseButton,
  TaskTreeRowLayout,
  TaskTreeSelectionButton,
  TreeListPanel,
} from '@/components/app';
import {
  Checkbox,
  ConfirmationDialog,
  IconButton,
  Input,
} from '@/components/ui';
import { CategoryAssignmentMenu, useCategoryTags } from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';
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
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
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
      <h3 className="text-sm font-medium text-muted">
        {dictionary.dayEditor.checklist}
      </h3>

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const focusAfterCreate = useFocusAfterCreate();
  const selectedCategory = item.categoryTagId
    ? (categoryTagMap.get(item.categoryTagId) ?? null)
    : null;
  const saveText = useCallback(
    async (nextText: string) => {
      if (!scope) {
        return;
      }

      await updateChecklistItemText({
        scope,
        itemId: item.id,
        text: nextText,
      });
    },
    [item.id, scope],
  );
  const {
    flush: flushText,
    setText,
    text,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope),
    onSave: saveText,
    value: item.text,
  });

  const createSibling = useCallback(async () => {
    if (!scope) {
      return null;
    }

    await flushText();
    const newItem = await createChecklistItem({
      scope,
      dailyEntryId,
      parentId: item.parentId,
      afterItemId: item.id,
    });
    return newItem.id;
  }, [dailyEntryId, flushText, item.id, item.parentId, scope]);

  const createChild = useCallback(async () => {
    if (!scope) {
      return;
    }

    await flushText();
    await createChecklistChild({ scope, dailyEntryId, parentItemId: item.id });
  }, [dailyEntryId, flushText, item.id, scope]);

  const deleteItem = useCallback(async () => {
    if (!scope) {
      return;
    }

    if (requiresDeleteConfirmation(text)) {
      setIsDeleteDialogOpen(true);
      return;
    }

    await softDeleteChecklistItem({ scope, itemId: item.id });
  }, [item.id, scope, text]);

  const confirmDeleteItem = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsDeleteDialogOpen(false);
    await softDeleteChecklistItem({ scope, itemId: item.id });
  }, [item.id, scope]);

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!scope) {
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await toggleChecklistItemChecked({ scope, itemId: item.id });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const newItemId = await createSibling();
      if (newItemId) {
        focusAfterCreate(newItemId);
      }
      return;
    }

    if (event.key === 'Tab') {
      const checklistInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(checklistInputSelector),
      );
      const currentIndex = checklistInputs.indexOf(event.currentTarget);
      const targetInput =
        checklistInputs[currentIndex + (event.shiftKey ? -1 : 1)];

      if (!targetInput) {
        return;
      }

      event.preventDefault();
      await flushText();

      window.requestAnimationFrame(() => {
        targetInput.focus();
        const caretPosition = targetInput.value.length;
        targetInput.setSelectionRange(caretPosition, caretPosition);
      });
      return;
    }

    if (event.key === 'Backspace' && text.length === 0) {
      event.preventDefault();
      await softDeleteChecklistItem({ scope, itemId: item.id });
    }
  }

  return (
    <>
      <TaskTreeRowLayout
        categoryColorHex={selectedCategory?.colorHex}
        depth={depth}
        isPriority={item.priority}
        isSelected={isSelected}
      >
        <TaskTreeCollapseButton
          collapseLabel={dictionary.dayEditor.collapseItem}
          expandLabel={dictionary.dayEditor.expandItem}
          hasChildren={hasChildren}
          isCollapsed={item.collapsed}
          onClick={() => {
            if (scope) {
              void toggleChecklistItemCollapsed({ scope, itemId: item.id });
            }
          }}
        />

        <Checkbox
          aria-label={dictionary.dayEditor.toggleItem}
          checked={item.checked}
          onChange={() => {
            if (scope) {
              void toggleChecklistItemChecked({ scope, itemId: item.id });
            }
          }}
        />

        <Input
          data-checklist-input="true"
          data-item-id={item.id}
          value={text}
          placeholder={dictionary.dayEditor.itemPlaceholder}
          className={`min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm outline-none transition focus:bg-surface focus:shadow-sm ${
            item.checked ? 'opacity-50' : 'text-foreground'
          }`}
          onBlur={() => void flushText()}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => void handleKeyDown(event)}
        />

        {selectedCategory ? (
          <TaskTreeCategoryChip
            colorHex={selectedCategory.colorHex}
            name={selectedCategory.name}
          />
        ) : null}

        <TaskTreeActionGroup>
          <IconButton
            aria-label={
              item.priority
                ? dictionary.dayEditor.unmarkPriority
                : dictionary.dayEditor.markPriority
            }
            onClick={() => {
              if (scope) {
                void toggleChecklistItemPriority({ scope, itemId: item.id });
              }
            }}
          >
            <Star
              aria-hidden="true"
              className={`size-4 ${item.priority ? 'fill-current text-amber-500' : 'opacity-60'}`}
            />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.addChild}
            onClick={createChild}
          >
            <Plus aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemUp}
            disabled={isFirstSibling}
            onClick={() => {
              if (scope) {
                void reorderChecklistItem({
                  scope,
                  itemId: item.id,
                  direction: 'up',
                });
              }
            }}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemDown}
            disabled={isLastSibling}
            onClick={() => {
              if (scope) {
                void reorderChecklistItem({
                  scope,
                  itemId: item.id,
                  direction: 'down',
                });
              }
            }}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.indentItem}
            disabled={isFirstSibling}
            onClick={() => {
              if (scope) {
                void indentChecklistItem({ scope, itemId: item.id });
              }
            }}
          >
            <IndentIncrease aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.outdentItem}
            disabled={depth === 0}
            onClick={() => {
              if (scope) {
                void outdentChecklistItem({ scope, itemId: item.id });
              }
            }}
          >
            <IndentDecrease aria-hidden="true" className="size-4" />
          </IconButton>
          <TaskTreeSelectionButton
            deselectLabel={dictionary.dayEditor.deselectItem}
            isSelected={isSelected}
            selectLabel={dictionary.dayEditor.selectItem}
            onToggle={(shiftKey) => onToggleSelect(item.id, shiftKey)}
          />
          <CategoryAssignmentMenu
            assignLabel={dictionary.dayEditor.assignCategory}
            clearLabel={dictionary.dayEditor.clearCategory}
            disabled={isSelectionMode && !isSelected}
            selectedCategoryTagId={item.categoryTagId}
            surface="calendar"
            onAssign={(categoryTagId) => {
              if (isSelectionMode) {
                return onBulkAssignCategory(categoryTagId);
              }

              if (scope) {
                return assignChecklistItemCategory({
                  scope,
                  itemId: item.id,
                  categoryTagId,
                });
              }

              return Promise.resolve();
            }}
          />
          <IconButton
            aria-label={dictionary.dayEditor.deleteItem}
            disabled={isSelectionMode && !isSelected}
            onClick={() =>
              isSelectionMode ? onBulkDelete() : void deleteItem()
            }
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </TaskTreeActionGroup>
      </TaskTreeRowLayout>

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.dayEditor.confirmDeleteItem}
        open={isDeleteDialogOpen}
        title={dictionary.dayEditor.deleteItem}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void confirmDeleteItem()}
      />
    </>
  );
}
