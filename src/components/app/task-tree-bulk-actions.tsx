'use client';

import { Star, Tag, Trash2 } from 'lucide-react';
import { CategoryAssignmentMenu } from '@/features/categories';
import type { CategoryTagSurface } from '@/lib/domain';
import { TaskTreeClearCategoryIcon } from './task-tree-clear-category-icon';
import {
  defaultTaskTreeRowActionPreferences,
  isTaskTreeBulkActionVisible,
  type TaskTreeRowActionPreferences,
} from './task-tree-row-action-visibility';

interface TaskTreeBulkActionLabels {
  bold: string;
  category: string;
  clearCategory: string;
  delete: string;
  priority: string;
  selected: string;
}

function bulkAriaLabel(label: string, selectedLabel: string) {
  return `${label} · ${selectedLabel}`;
}

export function TaskTreeBulkActions({
  actionPreferences = defaultTaskTreeRowActionPreferences,
  allBold,
  allPriority,
  labels,
  surface,
  onAssignCategory,
  onDelete,
  onToggleBold,
  onTogglePriority,
}: {
  actionPreferences?: TaskTreeRowActionPreferences;
  allBold: boolean;
  allPriority: boolean;
  labels: TaskTreeBulkActionLabels;
  surface: CategoryTagSurface;
  onAssignCategory: (categoryTagId: string | null) => Promise<void> | void;
  onDelete: () => void;
  onToggleBold: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
}) {
  const buttonClassName =
    'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-[#d8d0e8] shadow-sm transition hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]';

  return (
    <div
      data-tree-selection-actions
      className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
    >
      <span
        aria-live="polite"
        className="px-1 text-xs font-medium text-[#9f96b8]"
      >
        {labels.selected}
      </span>

      {isTaskTreeBulkActionVisible(actionPreferences, 'priority') ? (
        <button
          type="button"
          aria-label={bulkAriaLabel(labels.priority, labels.selected)}
          className={buttonClassName}
          onClick={() => void onTogglePriority()}
        >
          <Star
            aria-hidden="true"
            className={`size-3.5 ${
              allPriority ? 'fill-current text-[#f0c38e]' : ''
            }`}
          />
          <span>{labels.priority}</span>
        </button>
      ) : null}

      {isTaskTreeBulkActionVisible(actionPreferences, 'bold') ? (
        <button
          type="button"
          aria-label={bulkAriaLabel(labels.bold, labels.selected)}
          className={buttonClassName}
          onClick={() => void onToggleBold()}
        >
          <span
            aria-hidden="true"
            className={`text-sm leading-none ${
              allBold ? 'font-bold' : 'font-normal'
            }`}
          >
            B
          </span>
          <span>{labels.bold}</span>
        </button>
      ) : null}

      {isTaskTreeBulkActionVisible(actionPreferences, 'category') ? (
        <CategoryAssignmentMenu
          assignLabel={bulkAriaLabel(labels.category, labels.selected)}
          clearLabel={labels.clearCategory}
          menuPreferredWidth={288}
          selectedCategoryTagId={null}
          surface={surface}
          triggerClassName={buttonClassName}
          renderTriggerContent={() => (
            <>
              <Tag aria-hidden="true" className="size-3.5" />
              <span>{labels.category}</span>
            </>
          )}
          onAssign={onAssignCategory}
        />
      ) : null}

      {isTaskTreeBulkActionVisible(actionPreferences, 'clearCategory') ? (
        <button
          type="button"
          aria-label={bulkAriaLabel(labels.clearCategory, labels.selected)}
          className={buttonClassName}
          onClick={() => void onAssignCategory(null)}
        >
          <TaskTreeClearCategoryIcon className="size-3.5" />
          <span>{labels.clearCategory}</span>
        </button>
      ) : null}

      {isTaskTreeBulkActionVisible(actionPreferences, 'delete') ? (
        <button
          type="button"
          aria-label={bulkAriaLabel(labels.delete, labels.selected)}
          className={`${buttonClassName} text-rose-200 hover:bg-rose-400/[0.12] hover:text-rose-100`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
          <span>{labels.delete}</span>
        </button>
      ) : null}
    </div>
  );
}
