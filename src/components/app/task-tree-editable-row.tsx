'use client';

import {
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import {
  AutoResizeTextarea,
  Checkbox,
  ConfirmationDialog,
  IconButton,
} from '@/components/ui';
import { CategoryAssignmentMenu } from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import type { CategoryTagSurface } from '@/lib/domain';
import { TaskTreeActionGroup } from './task-tree-action-group';
import { TaskTreeCategoryChip } from './task-tree-category-chip';
import { TaskTreeCollapseButton } from './task-tree-collapse-button';
import { TaskTreeRowLayout } from './task-tree-row-layout';
import { TaskTreeSelectionButton } from './task-tree-selection-button';
import type { TreeMovePlacement } from './move-tree-item-to-target';

let activeTreeDrag: {
  itemId: string;
  nextSiblingId: string | null;
  parentId: string | null;
  previousSiblingId: string | null;
} | null = null;

interface TaskTreeRowLabels {
  addChild: string;
  assignCategory: string;
  cancel: string;
  clearCategory: string;
  collapseItem: string;
  confirmDeleteItem: string;
  delete: string;
  deleteItem: string;
  deselectItem: string;
  expandItem: string;
  indentItem: string;
  itemPlaceholder: string;
  markPriority: string;
  dragItem: string;
  itemTime: string;
  moveItemDown: string;
  moveItemUp: string;
  outdentItem: string;
  selectItem: string;
  toggleItem: string;
  unmarkPriority: string;
}

interface TaskTreeSelection {
  isSelected: boolean;
  isSelectionMode: boolean;
  onBulkAssignCategory: (categoryTagId: string | null) => Promise<void>;
  onBulkDelete: () => void;
  onBulkToggleChecked: (nextChecked: boolean) => Promise<void> | void;
  onToggle: (shiftKey: boolean) => void;
}

async function createAndFocusNewItem(
  createItem: () => Promise<string | null> | string | null,
  focusAfterCreate: (itemId: string) => void,
) {
  const newItemId = await createItem();

  if (newItemId) {
    focusAfterCreate(newItemId);
  }
}

export function TaskTreeEditableRow({
  categoryTagId,
  categoryTagMap,
  checked,
  collapsed,
  depth,
  hasChildren,
  inputDataAttribute,
  inputSelector,
  isFirstSibling,
  isLastSibling,
  itemId,
  labels,
  parentId,
  priority,
  selection,
  siblingIds,
  surface,
  text: sourceText,
  isDraft = false,
  onAssignCategory,
  onCreateChild,
  onCreateSibling,
  onDelete,
  onIndent,
  onMoveTo,
  onOutdent,
  onSaveTime,
  onSaveText,
  onTextChange,
  onToggleChecked,
  onToggleCollapsed,
  onTogglePriority,
  scheduledTime = null,
  showScheduledTime = false,
}: {
  categoryTagId: string | null;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  checked: boolean;
  collapsed: boolean;
  depth: number;
  hasChildren: boolean;
  inputDataAttribute:
    | 'data-bulk-checklist-input'
    | 'data-checklist-input'
    | 'data-goal-step-input';
  inputSelector: string;
  isFirstSibling: boolean;
  isLastSibling: boolean;
  itemId: string;
  labels: TaskTreeRowLabels;
  parentId: string | null;
  priority: boolean;
  selection?: TaskTreeSelection;
  siblingIds: string[];
  surface: CategoryTagSurface;
  text: string;
  isDraft?: boolean;
  onAssignCategory: (categoryTagId: string | null) => Promise<void> | void;
  onCreateChild: () => Promise<string | null> | string | null;
  onCreateSibling: () => Promise<string | null> | string | null;
  onDelete: () => Promise<void> | void;
  onIndent: () => Promise<void> | void;
  onMoveTo?: (move: {
    itemId: string;
    targetItemId: string;
    placement: TreeMovePlacement;
  }) => Promise<void> | void;
  onOutdent: () => Promise<void> | void;
  onSaveTime?: (scheduledTime: string | null) => Promise<void> | void;
  onSaveText: (text: string) => Promise<void> | void;
  onTextChange?: (text: string) => void;
  onToggleChecked: () => Promise<void> | void;
  onToggleCollapsed: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
  scheduledTime?: string | null;
  showScheduledTime?: boolean;
}) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dropPosition, setDropPosition] = useState<TreeMovePlacement | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isTextMultiline, setIsTextMultiline] = useState(false);
  const [optimisticChecked, setOptimisticChecked] = useState<{
    base: boolean;
    value: boolean;
  } | null>(null);
  const [optimisticPriority, setOptimisticPriority] = useState<{
    base: boolean;
    value: boolean;
  } | null>(null);
  const normalizedScheduledTime = scheduledTime ?? '';
  const [timeState, setTimeState] = useState({
    source: normalizedScheduledTime,
    value: normalizedScheduledTime,
  });
  const focusAfterCreate = useFocusAfterCreate();
  const selectedCategory = categoryTagId
    ? (categoryTagMap.get(categoryTagId) ?? null)
    : null;
  const normalizedChecked = checked ?? false;
  const normalizedPriority = priority ?? false;
  const displayedChecked =
    optimisticChecked !== null && optimisticChecked.base === normalizedChecked
      ? optimisticChecked.value
      : normalizedChecked;
  const displayedPriority =
    optimisticPriority !== null &&
    optimisticPriority.base === normalizedPriority
      ? optimisticPriority.value
      : normalizedPriority;
  const {
    flush: flushText,
    reset: resetText,
    setText,
    text,
  } = useDebouncedInlineEdit({
    onSave: onSaveText,
    value: sourceText,
  });

  const timeText =
    timeState.source === normalizedScheduledTime
      ? timeState.value
      : normalizedScheduledTime;

  const handleTextHeightChange = useCallback((height: number) => {
    setIsTextMultiline(height > 24);
  }, []);

  const flushEditableText = useCallback(async () => {
    if (text.trim().length > 0) {
      await flushText();
      return true;
    }

    if (isDraft) {
      return true;
    }

    resetText();
    return false;
  }, [flushText, isDraft, resetText, text]);

  const toggleChecked = useCallback(async () => {
    if (selection?.isSelectionMode) {
      if (!selection.isSelected) {
        return;
      }

      await selection.onBulkToggleChecked(!displayedChecked);
      return;
    }

    setOptimisticChecked({
      base: normalizedChecked,
      value: !displayedChecked,
    });

    try {
      await onToggleChecked();
    } catch (error) {
      setOptimisticChecked(null);
      throw error;
    }
  }, [displayedChecked, normalizedChecked, onToggleChecked, selection]);

  const togglePriority = useCallback(async () => {
    setOptimisticPriority({
      base: normalizedPriority,
      value: !displayedPriority,
    });

    try {
      await onTogglePriority();
    } catch (error) {
      setOptimisticPriority(null);
      throw error;
    }
  }, [displayedPriority, normalizedPriority, onTogglePriority]);

  const requestDelete = useCallback(async () => {
    if (requiresDeleteConfirmation(text)) {
      setIsDeleteDialogOpen(true);
      return;
    }

    await onDelete();
  }, [onDelete, text]);

  async function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && event.shiftKey) {
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await toggleChecked();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const didSave = await flushEditableText();

      if (!didSave) {
        return;
      }

      const newItemId = await onCreateSibling();

      if (newItemId) {
        focusAfterCreate(newItemId);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const didSave = await flushEditableText();

      if (!didSave) {
        return;
      }

      await createAndFocusNewItem(onCreateChild, focusAfterCreate);
      return;
    }

    if (event.key === 'Tab') {
      const inputs = Array.from(
        document.querySelectorAll<HTMLTextAreaElement>(inputSelector),
      );
      const currentIndex = inputs.indexOf(event.currentTarget);
      const targetInput = inputs[currentIndex + (event.shiftKey ? -1 : 1)];

      if (!targetInput) {
        return;
      }

      event.preventDefault();
      await flushEditableText();
      targetInput.focus();
      const caretPosition = targetInput.value.length;
      targetInput.setSelectionRange(caretPosition, caretPosition);
      return;
    }
  }

  function maskScheduledTimeInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);

    if (digits.length < 2) {
      return digits;
    }

    const hour = Math.min(Number(digits.slice(0, 2)), 23)
      .toString()
      .padStart(2, '0');

    if (digits.length === 2) {
      return hour;
    }

    const minuteDigits = digits.slice(2, 4);
    const minute =
      minuteDigits.length === 2
        ? Math.min(Number(minuteDigits), 59).toString().padStart(2, '0')
        : minuteDigits;

    return `${hour}:${minute}`;
  }

  async function saveScheduledTime() {
    if (!showScheduledTime || !onSaveTime) {
      return;
    }

    const nextTime = timeText.length === 5 ? timeText : null;

    if ((scheduledTime ?? null) === nextTime) {
      return;
    }

    await onSaveTime(nextTime);
  }

  function getDropPosition(
    event: DragEvent<HTMLDivElement>,
  ): TreeMovePlacement {
    const rect = event.currentTarget.getBoundingClientRect();

    if (rect.height <= 0) {
      return 'after';
    }

    const relativeY = event.clientY - rect.top;

    if (relativeY < rect.height * 0.25) {
      return 'before';
    }

    if (isLastSibling && relativeY > rect.height * 0.75) {
      return 'after';
    }

    return 'child';
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    setIsDragging(true);
    setDropPosition(null);
    const siblingIndex = siblingIds.indexOf(itemId);
    activeTreeDrag = {
      itemId,
      nextSiblingId: siblingIds[siblingIndex + 1] ?? null,
      parentId,
      previousSiblingId: siblingIds[siblingIndex - 1] ?? null,
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-tick-task-id', itemId);
    event.dataTransfer.setData(
      'application/x-tick-task-parent-id',
      parentId ?? '',
    );
    event.dataTransfer.setData('text/plain', itemId);
  }

  function getDraggedItemId(event: DragEvent<HTMLDivElement>): string {
    return (
      event.dataTransfer.getData('application/x-tick-task-id') ||
      event.dataTransfer.getData('text/plain') ||
      activeTreeDrag?.itemId ||
      ''
    );
  }

  function getValidDropPosition(
    event: DragEvent<HTMLDivElement>,
  ): TreeMovePlacement | null {
    const draggedItemId = getDraggedItemId(event);

    if (!draggedItemId || draggedItemId === itemId) {
      return null;
    }

    const placement = getDropPosition(event);
    const serializedParentId = event.dataTransfer.getData(
      'application/x-tick-task-parent-id',
    );
    const draggedParentId = serializedParentId
      ? serializedParentId
      : (activeTreeDrag?.parentId ?? null);

    if (placement === 'child' && draggedParentId === itemId) {
      return null;
    }

    if (draggedParentId === parentId) {
      if (placement === 'before' && activeTreeDrag?.nextSiblingId === itemId) {
        return null;
      }

      if (
        placement === 'after' &&
        activeTreeDrag?.previousSiblingId === itemId
      ) {
        return null;
      }
    }

    return placement;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onMoveTo) {
      return;
    }

    const draggedItemId = getDraggedItemId(event);
    setDropPosition(null);
    const placement = getValidDropPosition(event);
    activeTreeDrag = null;

    if (!placement) {
      return;
    }

    event.preventDefault();

    void onMoveTo({
      itemId: draggedItemId,
      targetItemId: itemId,
      placement,
    });
  }

  return (
    <>
      <TaskTreeRowLayout
        categoryColorHex={selectedCategory?.colorHex}
        depth={depth}
        isPriority={displayedPriority}
        isSelected={selection?.isSelected}
        dropPosition={isDragging ? null : dropPosition}
        isDragging={isDragging}
        onDragOver={(event) => {
          if (onMoveTo) {
            event.preventDefault();
            setDropPosition(getValidDropPosition(event));
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDropPosition(null);
          }
        }}
        onDrop={handleDrop}
      >
        <TaskTreeCollapseButton
          collapseLabel={labels.collapseItem}
          expandLabel={labels.expandItem}
          hasChildren={hasChildren}
          isCollapsed={collapsed}
          onClick={() => void onToggleCollapsed()}
        />

        <IconButton
          aria-label={labels.dragItem}
          className="cursor-grab rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] active:cursor-grabbing focus-visible:outline-[#f0c38e]"
          draggable
          onDragEnd={() => {
            setIsDragging(false);
            setDropPosition(null);
            activeTreeDrag = null;
          }}
          onDragStart={handleDragStart}
        >
          <GripVertical aria-hidden="true" className="size-4 opacity-70" />
        </IconButton>

        <Checkbox
          aria-label={labels.toggleItem}
          checked={displayedChecked}
          disabled={
            selection?.isSelectionMode === true && !selection.isSelected
          }
          onChange={() => void toggleChecked()}
        />

        {showScheduledTime ? (
          <input
            aria-label={labels.itemTime}
            inputMode="numeric"
            maxLength={5}
            placeholder="00:00"
            value={timeText}
            className="ml-2 h-6 w-[4rem] shrink-0 rounded-lg border border-white/10 bg-white/[0.045] px-1.5 text-center text-xs font-medium tabular-nums text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] focus:border-[#f0c38e]/40 focus:bg-white/[0.065] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            onBlur={() => void saveScheduledTime()}
            onChange={(event) =>
              setTimeState({
                source: normalizedScheduledTime,
                value: maskScheduledTimeInput(event.target.value),
              })
            }
          />
        ) : null}

        <div
          data-task-text-field
          className={`flex min-w-0 flex-1 rounded-xl border border-transparent bg-transparent transition focus-within:border-[#f0c38e]/28 focus-within:bg-white/[0.055] focus-within:shadow-sm ${
            isTextMultiline ? 'items-start pt-0.5 pb-0' : 'min-h-9 items-center'
          }`}
        >
          <AutoResizeTextarea
            {...{ [inputDataAttribute]: 'true' }}
            data-item-id={itemId}
            rows={1}
            value={text}
            placeholder={labels.itemPlaceholder}
            className={`min-w-0 w-full bg-transparent px-2 py-0 text-sm leading-5 outline-none placeholder:text-[#8f85aa] ${
              displayedChecked ? 'text-[#8f85aa] opacity-75' : 'text-[#fff9f2]'
            }`}
            onBlur={() => void flushEditableText()}
            onHeightChange={handleTextHeightChange}
            onChange={(event) => {
              setText(event.target.value);
              onTextChange?.(event.target.value);
            }}
            onKeyDown={(event) => void handleKeyDown(event)}
          />
        </div>

        {selectedCategory ? (
          <TaskTreeCategoryChip
            colorHex={selectedCategory.colorHex}
            name={selectedCategory.name}
          />
        ) : null}

        <TaskTreeActionGroup>
          <IconButton
            aria-label={
              displayedPriority ? labels.unmarkPriority : labels.markPriority
            }
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={() => void togglePriority()}
          >
            <Star
              aria-hidden="true"
              className={`size-4 ${
                displayedPriority ? 'fill-current text-[#f0c38e]' : 'opacity-60'
              }`}
            />
          </IconButton>
          <IconButton
            aria-label={labels.addChild}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={() =>
              void (async () => {
                await flushText();
                await createAndFocusNewItem(onCreateChild, focusAfterCreate);
              })()
            }
          >
            <Plus aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={labels.indentItem}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            disabled={isFirstSibling}
            onClick={() => void onIndent()}
          >
            <IndentIncrease aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={labels.outdentItem}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            disabled={depth === 0}
            onClick={() => void onOutdent()}
          >
            <IndentDecrease aria-hidden="true" className="size-4" />
          </IconButton>
          {selection ? (
            <TaskTreeSelectionButton
              deselectLabel={labels.deselectItem}
              isSelected={selection.isSelected}
              selectLabel={labels.selectItem}
              onToggle={selection.onToggle}
            />
          ) : null}
          <CategoryAssignmentMenu
            assignLabel={labels.assignCategory}
            clearLabel={labels.clearCategory}
            disabled={
              selection?.isSelectionMode === true && !selection.isSelected
            }
            selectedCategoryTagId={categoryTagId}
            surface={surface}
            onAssign={(nextCategoryTagId) => {
              if (selection?.isSelectionMode) {
                return selection.onBulkAssignCategory(nextCategoryTagId);
              }

              return onAssignCategory(nextCategoryTagId);
            }}
          />
          <IconButton
            aria-label={labels.deleteItem}
            className="mr-1 rounded-full hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-[#f0c38e]"
            disabled={
              selection?.isSelectionMode === true && !selection.isSelected
            }
            onClick={() =>
              selection?.isSelectionMode
                ? selection.onBulkDelete()
                : void requestDelete()
            }
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </TaskTreeActionGroup>
      </TaskTreeRowLayout>

      <ConfirmationDialog
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        description={labels.confirmDeleteItem}
        open={isDeleteDialogOpen}
        title={labels.deleteItem}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => {
          setIsDeleteDialogOpen(false);
          void onDelete();
        }}
      />
    </>
  );
}
