'use client';

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import {
  AutoResizeTextarea,
  ConfirmationDialog,
  IconButton,
} from '@/components/ui';
import { CategoryAssignmentMenu } from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import {
  defaultTaskCompletionSettings,
  getNextTaskCompletionValues,
  normalizeTaskCompletionValues,
  type CategoryTagSurface,
  type LocalDateString,
  type TaskCompletionSettings,
  type TaskCompletionValues,
} from '@/lib/domain';
import { formatDateInputValue, parseDateInputValue } from '@/lib/time';
import { DatePicker } from './date-picker';
import { TaskCompletionCheckbox } from './task-completion-checkbox';
import { TaskTreeActionGroup } from './task-tree-action-group';
import { TaskTreeCategoryChip } from './task-tree-category-chip';
import { TaskTreeCollapseButton } from './task-tree-collapse-button';
import { TaskTreeClearCategoryIcon } from './task-tree-clear-category-icon';
import { TaskTreeMoreActionsMenu } from './task-tree-more-actions-menu';
import { TaskTreeRowLayout } from './task-tree-row-layout';
import { TaskTreeSelectionButton } from './task-tree-selection-button';
import {
  defaultTaskTreeRowActionPreferences,
  hasTaskTreeMenuActions,
  type TaskTreeRowActionPreferences,
} from './task-tree-row-action-visibility';
import type { TreeMovePlacement } from './move-tree-item-to-target';
import {
  createTreeDragSource,
  resolveTreeDropPlacement,
  useTreeTouchDrag,
  validateTreeDrop,
  type TreeDragSource,
} from './tree-touch-drag';

let activeTreeDrag: TreeDragSource | null = null;

interface TaskTreeRowLabels {
  addChild: string;
  assignCategory: string;
  chooseCompletionState: string;
  completionStateCompleted: string;
  completionStateIgnored: string;
  completionStateLevel: string;
  completionStateUnchecked: string;
  bulkBold: string;
  bulkCategory: string;
  bulkDelete: string;
  bulkPriority: string;
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
  makeTextBold: string;
  makeTextNormal: string;
  markPriority: string;
  dragItem: string;
  itemTime: string;
  itemDate: string;
  moveItemDown: string;
  moveItemUp: string;
  moreActions: string;
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
  onBulkToggleChecked: (
    nextValues: TaskCompletionValues,
  ) => Promise<void> | void;
  onToggle: (shiftKey: boolean) => void;
}

function toCompletionKey(values: TaskCompletionValues): string {
  return values.ignored ? 'ignored' : String(values.markLevel);
}

function fromCompletionKey(key: string): TaskCompletionValues {
  return normalizeTaskCompletionValues(
    key === 'ignored' ? { ignored: true } : { markLevel: Number(key) },
  );
}

function formatShortDate(date: LocalDateString): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function useOptimisticValue<TValue>(currentValue: TValue) {
  const [optimisticValue, setOptimisticValue] = useState<{
    base: TValue;
    value: TValue;
  } | null>(null);
  const [lastValue, setLastValue] = useState(currentValue);

  if (lastValue !== currentValue) {
    setLastValue(currentValue);
    setOptimisticValue(null);
  }

  const displayedValue =
    optimisticValue !== null && optimisticValue.base === currentValue
      ? optimisticValue.value
      : currentValue;

  return [displayedValue, setOptimisticValue] as const;
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
  actionPreferences = defaultTaskTreeRowActionPreferences,
  bold,
  categoryTagId,
  categoryTagMap,
  checked,
  completionSettings = defaultTaskCompletionSettings,
  ignored = false,
  markLevel = 0,
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
  onMoveDown,
  onMoveUp,
  onOutdent,
  onSaveDate,
  onSaveTime,
  onSaveText,
  onSetCompletion,
  onTextChange,
  onToggleBold,
  onToggleChecked,
  onToggleCollapsed,
  onTogglePriority,
  scheduledDate = null,
  scheduledTime = null,
  showScheduledDate = false,
  showScheduledTime = false,
}: {
  actionPreferences?: TaskTreeRowActionPreferences;
  bold: boolean;
  categoryTagId: string | null;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  checked: boolean;
  completionSettings?: TaskCompletionSettings;
  ignored?: boolean;
  markLevel?: number;
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
  onMoveDown: () => Promise<void> | void;
  onMoveUp: () => Promise<void> | void;
  onOutdent: () => Promise<void> | void;
  onSaveDate?: (scheduledDate: LocalDateString | null) => Promise<void> | void;
  onSaveTime?: (scheduledTime: string | null) => Promise<void> | void;
  onSaveText: (text: string) => Promise<void> | void;
  onSetCompletion?: (nextValues: TaskCompletionValues) => Promise<void> | void;
  onTextChange?: (text: string) => void;
  onToggleBold: () => Promise<void> | void;
  onToggleChecked: () => Promise<void> | void;
  onToggleCollapsed: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
  scheduledDate?: LocalDateString | null;
  scheduledTime?: string | null;
  showScheduledDate?: boolean;
  showScheduledTime?: boolean;
}) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dropPosition, setDropPosition] = useState<TreeMovePlacement | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isTextMultiline, setIsTextMultiline] = useState(false);
  const normalizedScheduledTime = scheduledTime ?? '';
  const isSelectionMode = selection?.isSelectionMode === true;
  const [timeState, setTimeState] = useState({
    source: normalizedScheduledTime,
    value: normalizedScheduledTime,
  });
  const lastRequestedTimeRef = useRef<string | null | undefined>(undefined);
  const focusAfterCreate = useFocusAfterCreate();
  const selectedCategory = categoryTagId
    ? (categoryTagMap.get(categoryTagId) ?? null)
    : null;
  const normalizedBold = bold ?? false;
  const normalizedPriority = priority ?? false;
  const completionKey = toCompletionKey(
    normalizeTaskCompletionValues({ completed: checked, ignored, markLevel }),
  );
  const [displayedCompletionKey, setOptimisticCompletion] =
    useOptimisticValue(completionKey);
  const displayedCompletion = fromCompletionKey(displayedCompletionKey);
  const displayedChecked = displayedCompletion.completed;
  const displayedIgnored = displayedCompletion.ignored;
  const [displayedPriority, setOptimisticPriority] =
    useOptimisticValue(normalizedPriority);
  const [displayedBold, setOptimisticBold] = useOptimisticValue(normalizedBold);
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

  useEffect(() => {
    if (lastRequestedTimeRef.current === (scheduledTime ?? null)) {
      lastRequestedTimeRef.current = undefined;
    }
  }, [scheduledTime]);

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

  const applyCompletion = useCallback(
    async (
      nextValues: TaskCompletionValues,
      persist: () => Promise<void> | void,
    ) => {
      if (selection?.isSelectionMode) {
        if (!selection.isSelected) {
          return;
        }

        await selection.onBulkToggleChecked(nextValues);
        return;
      }

      setOptimisticCompletion({
        base: completionKey,
        value: toCompletionKey(nextValues),
      });

      try {
        await persist();
      } catch (error) {
        setOptimisticCompletion(null);
        throw error;
      }
    },
    [completionKey, selection, setOptimisticCompletion],
  );

  const toggleChecked = useCallback(async () => {
    await applyCompletion(
      getNextTaskCompletionValues(displayedCompletion, completionSettings),
      onToggleChecked,
    );
  }, [
    applyCompletion,
    completionSettings,
    displayedCompletion,
    onToggleChecked,
  ]);

  const selectCompletion = useCallback(
    async (nextValues: TaskCompletionValues) => {
      await applyCompletion(nextValues, () => onSetCompletion?.(nextValues));
    },
    [applyCompletion, onSetCompletion],
  );

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
  }, [
    displayedPriority,
    normalizedPriority,
    onTogglePriority,
    setOptimisticPriority,
  ]);

  const toggleBold = useCallback(async () => {
    setOptimisticBold({
      base: normalizedBold,
      value: !displayedBold,
    });

    try {
      await onToggleBold();
    } catch (error) {
      setOptimisticBold(null);
      throw error;
    }
  }, [displayedBold, normalizedBold, onToggleBold, setOptimisticBold]);

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

    if (
      (scheduledTime ?? null) === nextTime ||
      lastRequestedTimeRef.current === nextTime
    ) {
      return;
    }

    lastRequestedTimeRef.current = nextTime;

    try {
      await onSaveTime(nextTime);
    } catch (error) {
      lastRequestedTimeRef.current = undefined;
      throw error;
    }
  }

  function updateScheduledTime(value: string) {
    const nextValue = maskScheduledTimeInput(value);

    setTimeState({
      source: normalizedScheduledTime,
      value: nextValue,
    });

    if (nextValue.length !== 0 && nextValue.length !== 5) {
      return;
    }

    const nextTime = nextValue.length === 5 ? nextValue : null;

    if (
      !onSaveTime ||
      (scheduledTime ?? null) === nextTime ||
      lastRequestedTimeRef.current === nextTime
    ) {
      return;
    }

    lastRequestedTimeRef.current = nextTime;
    void Promise.resolve(onSaveTime(nextTime)).catch(() => {
      lastRequestedTimeRef.current = undefined;
    });
  }

  const { isTouchDragging, startTouchDrag, touchDropPosition } =
    useTreeTouchDrag({
      enabled: actionPreferences.drag && !isSelectionMode,
      itemId,
      onMoveTo,
      parentId,
      siblingIds,
    });

  function getDropPosition(
    event: DragEvent<HTMLDivElement>,
  ): TreeMovePlacement {
    const rect = event.currentTarget.getBoundingClientRect();

    return resolveTreeDropPlacement({
      height: rect.height,
      isLastSibling,
      offsetY: event.clientY - rect.top,
    });
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    setIsDragging(true);
    setDropPosition(null);
    activeTreeDrag = createTreeDragSource({ itemId, parentId, siblingIds });
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

    if (!draggedItemId) {
      return null;
    }

    const serializedParentId = event.dataTransfer.getData(
      'application/x-tick-task-parent-id',
    );

    return validateTreeDrop({
      dragged: {
        itemId: draggedItemId,
        nextSiblingId: activeTreeDrag?.nextSiblingId ?? null,
        parentId: serializedParentId
          ? serializedParentId
          : (activeTreeDrag?.parentId ?? null),
        previousSiblingId: activeTreeDrag?.previousSiblingId ?? null,
      },
      placement: getDropPosition(event),
      target: { itemId, parentId },
    });
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
        isLastSibling={isLastSibling}
        isPriority={displayedPriority}
        isSelected={selection?.isSelected}
        itemId={itemId}
        parentId={parentId}
        dropPosition={
          isDragging || isTouchDragging
            ? null
            : (dropPosition ?? touchDropPosition)
        }
        isDragging={isDragging || isTouchDragging}
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
          disabled={isSelectionMode}
          expandLabel={labels.expandItem}
          hasChildren={hasChildren}
          isCollapsed={collapsed}
          onClick={() => void onToggleCollapsed()}
        />

        {actionPreferences.drag ? (
          <IconButton
            aria-label={labels.dragItem}
            className="tree-drag-handle cursor-grab rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] active:cursor-grabbing focus-visible:outline-[#f0c38e]"
            disabled={isSelectionMode}
            draggable={!isSelectionMode}
            onDragEnd={() => {
              setIsDragging(false);
              setDropPosition(null);
              activeTreeDrag = null;
            }}
            onDragStart={handleDragStart}
            onPointerDown={startTouchDrag}
          >
            <GripVertical aria-hidden="true" className="size-4 opacity-70" />
          </IconButton>
        ) : null}

        <TaskCompletionCheckbox
          completionSettings={completionSettings}
          disabled={
            selection?.isSelectionMode === true && !selection.isSelected
          }
          labels={labels}
          values={displayedCompletion}
          onSelect={
            onSetCompletion || selection?.isSelectionMode
              ? selectCompletion
              : undefined
          }
          onToggle={toggleChecked}
        />

        {showScheduledTime && actionPreferences.scheduledTime ? (
          <input
            aria-label={labels.itemTime}
            inputMode="numeric"
            maxLength={5}
            placeholder="00:00"
            value={timeText}
            className="ml-2 h-6 w-[4rem] shrink-0 rounded-lg inset-ring-hairline inset-ring-white/10 bg-white/[0.045] px-1.5 text-center text-xs font-medium tabular-nums text-[#fff9f2] outline-none transition placeholder:text-[#7b8da0] focus:inset-ring-[#f0c38e]/40 focus:bg-white/[0.065] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            onBlur={() => void saveScheduledTime()}
            onChange={(event) => updateScheduledTime(event.target.value)}
          />
        ) : null}

        {showScheduledDate && actionPreferences.scheduledDate ? (
          <DatePicker
            label={labels.itemDate}
            value={scheduledDate ? formatDateInputValue(scheduledDate) : ''}
            variant="trigger"
            onChange={(nextValue) => {
              const nextDate = parseDateInputValue(nextValue);

              if (nextDate) {
                void onSaveDate?.(nextDate);
              }
            }}
            onClear={() => void onSaveDate?.(null)}
            renderTrigger={({ onClick, ariaLabel }) => (
              <button
                type="button"
                aria-label={ariaLabel}
                className="ml-2 flex h-6 w-16 shrink-0 items-center justify-center gap-1 rounded-lg inset-ring-hairline inset-ring-white/10 bg-white/4.5 px-1.5 text-center text-xs font-medium tabular-nums text-[#fff9f2] outline-none transition hover:inset-ring-white/20 hover:bg-white/6.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={onClick}
              >
                {scheduledDate ? (
                  formatShortDate(scheduledDate)
                ) : (
                  <CalendarDays
                    aria-hidden="true"
                    className="size-3.5 opacity-70"
                  />
                )}
              </button>
            )}
          />
        ) : null}

        <div
          data-task-text-field
          className={`flex min-w-0 flex-1 rounded-xl inset-ring-hairline inset-ring-transparent bg-transparent transition focus-within:inset-ring-[#f0c38e]/28 focus-within:bg-white/[0.055] focus-within:shadow-sm ${
            isTextMultiline ? 'items-start pt-0.5 pb-0' : 'min-h-9 items-center'
          }`}
        >
          <AutoResizeTextarea
            {...{ [inputDataAttribute]: 'true' }}
            data-item-id={itemId}
            rows={1}
            value={text}
            placeholder={labels.itemPlaceholder}
            className={`min-w-0 w-full bg-transparent px-2 py-0 text-sm leading-5 outline-none placeholder:text-[#7b8da0] ${
              displayedChecked || displayedIgnored
                ? 'text-[#7b8da0] opacity-75'
                : 'text-[#fff9f2]'
            } ${displayedBold ? 'font-bold' : 'font-normal'}`}
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
          {selection ? (
            <TaskTreeSelectionButton
              deselectLabel={labels.deselectItem}
              isSelected={selection.isSelected}
              selectLabel={labels.selectItem}
              onToggle={selection.onToggle}
            />
          ) : null}
          {actionPreferences.add === 'inline' ? (
            <IconButton
              aria-label={labels.addChild}
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode}
              onClick={() =>
                void (async () => {
                  await flushText();
                  await createAndFocusNewItem(onCreateChild, focusAfterCreate);
                })()
              }
            >
              <Plus aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
          {actionPreferences.moveUp === 'inline' ? (
            <IconButton
              aria-label={labels.moveItemUp}
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode || isFirstSibling}
              onClick={() => void onMoveUp()}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
          {actionPreferences.moveDown === 'inline' ? (
            <IconButton
              aria-label={labels.moveItemDown}
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode || isLastSibling}
              onClick={() => void onMoveDown()}
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
          {actionPreferences.outdent === 'inline' ? (
            <IconButton
              aria-label={labels.outdentItem}
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode || depth === 0}
              onClick={() => void onOutdent()}
            >
              <IndentDecrease aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
          {actionPreferences.indent === 'inline' ? (
            <IconButton
              aria-label={labels.indentItem}
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode || isFirstSibling}
              onClick={() => void onIndent()}
            >
              <IndentIncrease aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
          {actionPreferences.priority === 'inline' ? (
            <IconButton
              aria-label={
                displayedPriority ? labels.unmarkPriority : labels.markPriority
              }
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode}
              onClick={() => void togglePriority()}
            >
              <Star
                aria-hidden="true"
                className={`size-4 ${
                  displayedPriority ? 'fill-current text-[#f0c38e]' : ''
                }`}
              />
            </IconButton>
          ) : null}
          {actionPreferences.bold === 'inline' ? (
            <IconButton
              aria-label={
                displayedBold ? labels.makeTextNormal : labels.makeTextBold
              }
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode}
              onClick={() => void toggleBold()}
            >
              <span
                aria-hidden="true"
                className={`text-base leading-none ${
                  displayedBold ? 'font-bold' : 'font-normal'
                }`}
              >
                B
              </span>
            </IconButton>
          ) : null}
          {actionPreferences.category === 'inline' ? (
            <CategoryAssignmentMenu
              assignLabel={labels.assignCategory}
              clearLabel={labels.clearCategory}
              disabled={isSelectionMode}
              renderTriggerContent={() => (
                <Tag aria-hidden="true" className="size-4" />
              )}
              selectedCategoryTagId={categoryTagId}
              showClearButton={false}
              surface={surface}
              triggerClassName="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              onAssign={onAssignCategory}
            />
          ) : null}
          {actionPreferences.clearCategory === 'inline' ? (
            <IconButton
              aria-label={labels.clearCategory}
              className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode || !categoryTagId}
              onClick={() => void onAssignCategory(null)}
            >
              <TaskTreeClearCategoryIcon className="size-4" />
            </IconButton>
          ) : null}
          {actionPreferences.delete === 'inline' ? (
            <IconButton
              aria-label={labels.deleteItem}
              className="rounded-full text-rose-200 hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-[#f0c38e]"
              disabled={isSelectionMode}
              onClick={() => void requestDelete()}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
          {hasTaskTreeMenuActions(actionPreferences) ? (
            <TaskTreeMoreActionsMenu
              actionPreferences={actionPreferences}
              bold={displayedBold}
              canIndent={!isFirstSibling}
              canMoveDown={!isLastSibling}
              canMoveUp={!isFirstSibling}
              canOutdent={depth > 0}
              categoryTagMap={categoryTagMap}
              disabled={isSelectionMode}
              labels={labels}
              priority={displayedPriority}
              selectedCategoryTagId={categoryTagId}
              onAdd={async () => {
                await flushText();
                await createAndFocusNewItem(onCreateChild, focusAfterCreate);
              }}
              onAssignCategory={onAssignCategory}
              onDelete={requestDelete}
              onIndent={onIndent}
              onMoveDown={onMoveDown}
              onMoveUp={onMoveUp}
              onOutdent={onOutdent}
              onToggleBold={toggleBold}
              onTogglePriority={togglePriority}
            />
          ) : null}
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
