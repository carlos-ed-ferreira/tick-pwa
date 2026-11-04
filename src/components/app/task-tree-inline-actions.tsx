import {
  ArrowDown,
  ArrowUp,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui';
import { CategoryAssignmentMenu } from '@/features/categories';
import type { CategoryTagSurface } from '@/lib/domain';
import { TaskTreeClearCategoryIcon } from './task-tree-clear-category-icon';
import type { TaskTreeRowActionPreferences } from './task-tree-row-action-visibility';
import type { TaskTreeRowAvailabilityState } from './task-tree-row-availability';

interface TaskTreeInlineActionLabels {
  addChild: string;
  assignCategory: string;
  clearCategory: string;
  deleteItem: string;
  indentItem: string;
  makeTextBold: string;
  makeTextNormal: string;
  markPriority: string;
  moveItemDown: string;
  moveItemUp: string;
  outdentItem: string;
  unmarkPriority: string;
}

type InlineActionKey = Exclude<
  keyof TaskTreeRowActionPreferences,
  'category' | 'drag' | 'scheduledDate' | 'scheduledTime'
>;

interface InlineIconAction {
  action: InlineActionKey;
  className?: string;
  content: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => Promise<void> | void;
}

type TaskTreeInlineActionsProps = {
  actionPreferences: TaskTreeRowActionPreferences;
  availability: TaskTreeRowAvailabilityState;
  bold: boolean;
  categoryTagId: string | null;
  labels: TaskTreeInlineActionLabels;
  priority: boolean;
  surface: CategoryTagSurface;
  onAdd: () => Promise<void> | void;
  onAssignCategory: (categoryTagId: string | null) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onIndent: () => Promise<void> | void;
  onMoveDown: () => Promise<void> | void;
  onMoveUp: () => Promise<void> | void;
  onOutdent: () => Promise<void> | void;
  onToggleBold: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
};

const inlineActionClassName =
  'rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';

function getStructureActions({
  availability,
  labels,
  onAdd,
  onIndent,
  onMoveDown,
  onMoveUp,
  onOutdent,
}: TaskTreeInlineActionsProps): InlineIconAction[] {
  return [
    {
      action: 'add',
      content: <Plus aria-hidden="true" className="size-4" />,
      disabled: availability.isLocked,
      label: labels.addChild,
      onClick: onAdd,
    },
    {
      action: 'moveUp',
      content: <ArrowUp aria-hidden="true" className="size-4" />,
      disabled: availability.inlineDisabled.moveUp,
      label: labels.moveItemUp,
      onClick: onMoveUp,
    },
    {
      action: 'moveDown',
      content: <ArrowDown aria-hidden="true" className="size-4" />,
      disabled: availability.inlineDisabled.moveDown,
      label: labels.moveItemDown,
      onClick: onMoveDown,
    },
    {
      action: 'outdent',
      content: <IndentDecrease aria-hidden="true" className="size-4" />,
      disabled: availability.inlineDisabled.outdent,
      label: labels.outdentItem,
      onClick: onOutdent,
    },
    {
      action: 'indent',
      content: <IndentIncrease aria-hidden="true" className="size-4" />,
      disabled: availability.inlineDisabled.indent,
      label: labels.indentItem,
      onClick: onIndent,
    },
  ];
}

function getFormattingActions({
  availability,
  bold,
  labels,
  priority,
  onToggleBold,
  onTogglePriority,
}: TaskTreeInlineActionsProps): InlineIconAction[] {
  return [
    {
      action: 'priority',
      content: (
        <Star
          aria-hidden="true"
          className={`size-4 ${priority ? 'fill-current text-[#f0c38e]' : ''}`}
        />
      ),
      disabled: availability.isLocked,
      label: priority ? labels.unmarkPriority : labels.markPriority,
      onClick: onTogglePriority,
    },
    {
      action: 'bold',
      content: (
        <span
          aria-hidden="true"
          className={`text-base leading-none ${bold ? 'font-bold' : 'font-normal'}`}
        >
          B
        </span>
      ),
      disabled: availability.isLocked,
      label: bold ? labels.makeTextNormal : labels.makeTextBold,
      onClick: onToggleBold,
    },
  ];
}

function getCleanupActions({
  availability,
  labels,
  onAssignCategory,
  onDelete,
}: TaskTreeInlineActionsProps): InlineIconAction[] {
  return [
    {
      action: 'clearCategory',
      content: <TaskTreeClearCategoryIcon className="size-4" />,
      disabled: availability.inlineDisabled.clearCategory,
      label: labels.clearCategory,
      onClick: () => onAssignCategory(null),
    },
    {
      action: 'delete',
      className:
        'rounded-full text-rose-200 hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-[#f0c38e]',
      content: <Trash2 aria-hidden="true" className="size-4" />,
      disabled: availability.inlineDisabled.delete,
      label: labels.deleteItem,
      onClick: onDelete,
    },
  ];
}

function InlineIconActions({
  actionPreferences,
  actions,
}: {
  actionPreferences: TaskTreeRowActionPreferences;
  actions: InlineIconAction[];
}) {
  return actions
    .filter(({ action }) => actionPreferences[action] === 'inline')
    .map(({ action, className, content, disabled, label, onClick }) => (
      <IconButton
        key={action}
        aria-label={label}
        className={className ?? inlineActionClassName}
        disabled={disabled}
        onClick={() => void onClick()}
      >
        {content}
      </IconButton>
    ));
}

export function TaskTreeInlineActions(props: TaskTreeInlineActionsProps) {
  const {
    actionPreferences,
    availability,
    categoryTagId,
    labels,
    surface,
    onAssignCategory,
  } = props;

  return (
    <>
      <InlineIconActions
        actionPreferences={actionPreferences}
        actions={[
          ...getStructureActions(props),
          ...getFormattingActions(props),
        ]}
      />
      {actionPreferences.category === 'inline' ? (
        <CategoryAssignmentMenu
          assignLabel={labels.assignCategory}
          clearLabel={labels.clearCategory}
          disabled={availability.isLocked}
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
      <InlineIconActions
        actionPreferences={actionPreferences}
        actions={getCleanupActions(props)}
      />
    </>
  );
}
