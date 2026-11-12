'use client';

import {
  CheckSquare,
  GripVertical,
  ArrowDown,
  ArrowUp,
  IndentDecrease,
  IndentIncrease,
  MoreHorizontal,
  Plus,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BottomSheet, BottomSheetAction, IconButton } from '@/components/ui';
import { CategoryAssignmentMenu } from '@/features/categories';
import type { CategoryTagSurface } from '@/lib/domain';
import { TaskTreeClearCategoryIcon } from './task-tree-clear-category-icon';
import type { TaskTreeRowActionPreferences } from './task-tree-row-action-visibility';
import type { TaskTreeRowAvailability } from './task-tree-row-availability';

export interface TaskTreeRowActionsSheetLabels {
  addChild: string;
  assignCategory: string;
  cancel: string;
  clearCategory: string;
  deleteItem: string;
  dragItem: string;
  selectItem: string;
  deselectItem: string;
  indentItem: string;
  itemDate: string;
  itemTime: string;
  makeTextBold: string;
  makeTextNormal: string;
  markPriority: string;
  moreActions: string;
  moveItemDown: string;
  moveItemUp: string;
  outdentItem: string;
  unmarkPriority: string;
}

const actionRowClassName =
  'touch-target flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#e5ebf3] transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-40';

export function TaskTreeRowActionsSheet({
  actionPreferences,
  availability,
  bold,
  categoryTagId,
  dateTrigger,
  disabled = false,
  labels,
  priority,
  showScheduledDate,
  showScheduledTime,
  surface,
  timeField,
  isSelected = false,
  onSelect,
  onPrepareDrag,
  onAdd,
  onAssignCategory,
  onDelete,
  onIndent,
  onMoveDown,
  onMoveUp,
  onOutdent,
  onToggleBold,
  onTogglePriority,
}: {
  actionPreferences: TaskTreeRowActionPreferences;
  availability: TaskTreeRowAvailability;
  bold: boolean;
  categoryTagId: string | null;
  dateTrigger: ReactNode;
  disabled?: boolean;
  labels: TaskTreeRowActionsSheetLabels;
  priority: boolean;
  showScheduledDate: boolean;
  showScheduledTime: boolean;
  surface: CategoryTagSurface;
  timeField: ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  onPrepareDrag?: () => void;
  onAdd: () => Promise<void> | void;
  onAssignCategory: (categoryTagId: string | null) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onIndent: () => Promise<void> | void;
  onMoveDown: () => Promise<void> | void;
  onMoveUp: () => Promise<void> | void;
  onOutdent: () => Promise<void> | void;
  onToggleBold: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isVisible = (action: keyof TaskTreeRowActionPreferences) =>
    actionPreferences[action] !== 'hidden';

  function runAction(action: () => Promise<void> | void) {
    setIsOpen(false);
    void action();
  }

  return (
    <>
      <IconButton
        aria-label={labels.moreActions}
        className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </IconButton>
      <BottomSheet
        closeLabel={labels.cancel}
        open={isOpen}
        title={labels.moreActions}
        onClose={() => setIsOpen(false)}
      >
        {showScheduledTime || showScheduledDate ? (
          <div className="flex items-center gap-2 px-3">
            {showScheduledTime ? timeField : null}
            {showScheduledDate ? (
              <DatePickerSlot>{dateTrigger}</DatePickerSlot>
            ) : null}
          </div>
        ) : null}

        {onSelect ? (
          <BottomSheetAction
            icon={<CheckSquare aria-hidden="true" className="size-4" />}
            onSelect={() => runAction(onSelect)}
          >
            {isSelected ? labels.deselectItem : labels.selectItem}
          </BottomSheetAction>
        ) : null}
        {onPrepareDrag ? (
          <BottomSheetAction
            icon={<GripVertical aria-hidden="true" className="size-4" />}
            onSelect={() => runAction(onPrepareDrag)}
          >
            {labels.dragItem}
          </BottomSheetAction>
        ) : null}
        <TaskTreeStructureActions
          {...{
            actionPreferences,
            availability,
            labels,
            onAdd,
            onMoveUp,
            onMoveDown,
            onIndent,
            onOutdent,
            runAction,
          }}
        />
        {isVisible('priority') ? (
          <BottomSheetAction
            ariaLabel={priority ? labels.unmarkPriority : labels.markPriority}
            icon={
              <Star
                aria-hidden="true"
                className={`size-4 ${priority ? 'fill-[#f0c38e] text-[#f0c38e]' : ''}`}
              />
            }
            disabled={!availability.canEditContent}
            onSelect={() => runAction(onTogglePriority)}
          >
            {priority ? labels.unmarkPriority : labels.markPriority}
          </BottomSheetAction>
        ) : null}
        {isVisible('bold') ? (
          <BottomSheetAction
            ariaLabel={bold ? labels.makeTextNormal : labels.makeTextBold}
            icon={
              <span
                aria-hidden="true"
                className="grid size-4 place-items-center text-xs font-bold"
              >
                B
              </span>
            }
            disabled={!availability.canEditContent}
            onSelect={() => runAction(onToggleBold)}
          >
            {bold ? labels.makeTextNormal : labels.makeTextBold}
          </BottomSheetAction>
        ) : null}
        {isVisible('category') ? (
          <CategoryAssignmentMenu
            assignLabel={labels.assignCategory}
            clearLabel={labels.clearCategory}
            disabled={!availability.canEditContent}
            renderTriggerContent={() => (
              <>
                <Tag aria-hidden="true" className="size-4" />
                <span className="min-w-0 flex-1 truncate">
                  {labels.assignCategory}
                </span>
              </>
            )}
            selectedCategoryTagId={categoryTagId}
            showClearButton={false}
            surface={surface}
            triggerClassName={actionRowClassName}
            onAssign={(nextCategoryTagId) => {
              setIsOpen(false);
              void onAssignCategory(nextCategoryTagId);
            }}
          />
        ) : null}
        {isVisible('clearCategory') ? (
          <BottomSheetAction
            ariaLabel={labels.clearCategory}
            disabled={!availability.canClearCategory}
            icon={<TaskTreeClearCategoryIcon className="size-4" />}
            onSelect={() => runAction(() => onAssignCategory(null))}
          >
            {labels.clearCategory}
          </BottomSheetAction>
        ) : null}
        {isVisible('delete') ? (
          <BottomSheetAction
            ariaLabel={labels.deleteItem}
            icon={<Trash2 aria-hidden="true" className="size-4" />}
            tone="danger"
            onSelect={() => runAction(onDelete)}
          >
            {labels.deleteItem}
          </BottomSheetAction>
        ) : null}
      </BottomSheet>
    </>
  );
}

function DatePickerSlot({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 items-center">{children}</div>;
}

type StructureActionsProps = Pick<
  Parameters<typeof TaskTreeRowActionsSheet>[0],
  | 'actionPreferences'
  | 'availability'
  | 'labels'
  | 'onAdd'
  | 'onMoveUp'
  | 'onMoveDown'
  | 'onIndent'
  | 'onOutdent'
> & {
  runAction: (action: () => Promise<void> | void) => void;
};

function TaskTreeStructureActions({
  actionPreferences,
  availability,
  labels,
  onAdd,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  runAction,
}: StructureActionsProps) {
  return (
    <>
      {[
        {
          key: 'add',
          label: labels.addChild,
          icon: Plus,
          enabled: availability.canEditContent,
          run: onAdd,
        },
        {
          key: 'moveUp',
          label: labels.moveItemUp,
          icon: ArrowUp,
          enabled: availability.canMoveUp,
          run: onMoveUp,
        },
        {
          key: 'moveDown',
          label: labels.moveItemDown,
          icon: ArrowDown,
          enabled: availability.canMoveDown,
          run: onMoveDown,
        },
        {
          key: 'outdent',
          label: labels.outdentItem,
          icon: IndentDecrease,
          enabled: availability.canOutdent,
          run: onOutdent,
        },
        {
          key: 'indent',
          label: labels.indentItem,
          icon: IndentIncrease,
          enabled: availability.canIndent,
          run: onIndent,
        },
      ]
        .filter(
          (action) =>
            actionPreferences[
              action.key as keyof TaskTreeRowActionPreferences
            ] !== 'hidden',
        )
        .map(({ key, label, icon: Icon, enabled, run }) => (
          <BottomSheetAction
            key={key}
            ariaLabel={label}
            disabled={!enabled}
            icon={<Icon aria-hidden="true" className="size-4" />}
            onSelect={() => runAction(run)}
          >
            {label}
          </BottomSheetAction>
        ))}
    </>
  );
}
