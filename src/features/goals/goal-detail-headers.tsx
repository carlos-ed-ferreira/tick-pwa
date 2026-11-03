'use client';

import {
  Archive,
  ArrowLeft,
  CalendarDays,
  RotateCcw,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { DatePicker, TaskTreeClearCategoryIcon } from '@/components/app';
import { ConfirmationDialog, IconButton, Input } from '@/components/ui';
import { CategoryAssignmentMenu } from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import { toAlphaColor } from '@/lib/color';
import {
  formatDateInputValue,
  parseDateInputValue,
  parseLocalDateKey,
} from '@/lib/time';
import {
  assignGoalCategory,
  assignGoalGroupCategory,
  softDeleteGoal,
  softDeleteGoalGroup,
  updateGoalDueDate,
  updateGoalGroupTitle,
  updateGoalTitle,
} from '@/lib/db';
import type { CategoryTag, Goal, GoalGroup } from '@/lib/domain';
import { useTouchComposition } from '@/hooks/use-touch-composition';
import { GoalDetailActionsSheet } from './goal-detail-actions-sheet';
import { useAppContext } from '@/providers';
import { CategoryColorButton } from './goal-category-controls';

function GoalGroupTitleEditor({
  autoFocus,
  group,
}: {
  autoFocus?: boolean;
  group: GoalGroup;
}) {
  const { dictionary, scope } = useAppContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    flush: flushTitle,
    setText: setTitle,
    text: editableTitle,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope),
    onSave: async (nextTitle) => {
      if (!scope) return;
      if (nextTitle.normalize('NFC').trim().length === 0) {
        setTitle(group.title);
        return;
      }

      await updateGoalGroupTitle({
        scope,
        goalGroupId: group.id,
        title: nextTitle,
      });
    },
    value: group.title,
  });
  const titleMeasurement = editableTitle || ' ';

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [autoFocus]);

  return (
    <span className="relative inline-block min-w-0 max-w-full shrink align-middle">
      <span
        aria-hidden="true"
        className="invisible block max-w-full overflow-hidden whitespace-pre rounded-md px-2 py-1 text-2xl font-semibold"
      >
        {titleMeasurement}
      </span>
      <Input
        ref={inputRef}
        aria-label={dictionary.goals.renameGroup}
        className="absolute inset-0 h-full w-full rounded-md bg-transparent px-2 py-1 text-2xl font-semibold text-[#fff9f2] outline-none transition focus:bg-white/[0.04] focus:inset-ring-hairline focus:inset-ring-[#f0c38e]/35"
        value={editableTitle}
        onBlur={() => void flushTitle()}
        onChange={(event) => setTitle(event.target.value.toUpperCase())}
      />
    </span>
  );
}

export function GoalGroupDetailHeader({
  goalGroupCategoryMap,
  group,
  onBack,
  onDelete,
}: {
  goalGroupCategoryMap: Map<string, CategoryTag>;
  group: GoalGroup;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { dictionary, scope } = useAppContext();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const groupCategory =
    goalGroupCategoryMap.get(group.categoryTagId ?? '') ?? null;
  const deleteGroup = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsDeleteDialogOpen(false);
    await softDeleteGoalGroup({ scope, goalGroupId: group.id });
    onDelete();
  }, [group.id, onDelete, scope]);

  return (
    <>
      <header className="flex flex-col gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2 sm:px-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          <GoalGroupTitleEditor autoFocus={false} group={group} />
          {groupCategory && !groupCategory.useOwnName ? (
            <span
              className="inline-flex min-h-10 max-w-full shrink-0 items-center rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-3 py-1 text-sm font-medium text-[#f7e8ce] shadow-sm shadow-[#253241]/10"
              style={
                {
                  '--chip-edge': toAlphaColor(groupCategory.colorHex, 0.6),
                  backgroundColor: toAlphaColor(groupCategory.colorHex, 0.14),
                } as CSSProperties
              }
            >
              <span className="truncate">{groupCategory.name}</span>
            </span>
          ) : null}
          <CategoryColorButton
            onAssign={(categoryTagId) =>
              scope
                ? assignGoalGroupCategory({
                    scope,
                    goalGroupId: group.id,
                    categoryTagId,
                  })
                : undefined
            }
            scope={scope}
            selectedCategory={groupCategory}
            surface="goal_group"
          />
          <CategoryAssignmentMenu
            assignLabel={dictionary.goals.assignGroupCategory}
            clearClassName="inline-flex size-10 shrink-0 items-center justify-center rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
            clearLabel={dictionary.goals.clearGroupCategory}
            renderClearContent={() => (
              <TaskTreeClearCategoryIcon className="size-4" />
            )}
            renderTriggerContent={() => (
              <Tag aria-hidden="true" className="size-4" />
            )}
            selectedCategoryTagId={group.categoryTagId}
            surface="goal_group"
            triggerClassName="inline-flex size-10 shrink-0 items-center justify-center rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:inset-ring-white/10 disabled:hover:bg-white/5 disabled:hover:text-[#cbd5e0]"
            onAssign={(categoryTagId) => {
              if (!scope) return;

              return assignGoalGroupCategory({
                scope,
                goalGroupId: group.id,
                categoryTagId,
              });
            }}
          />
          <IconButton
            aria-label={dictionary.goals.deleteGroup}
            className="size-10 rounded-md inset-ring-hairline inset-ring-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/18 hover:text-rose-50 focus-visible:outline-rose-200"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {dictionary.goals.backToGoalGroups}
        </button>
      </header>
      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.goals.deleteGroup}
        description={dictionary.goals.confirmDeleteGroup}
        open={isDeleteDialogOpen}
        title={dictionary.goals.deleteGroup}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void deleteGroup()}
      />
    </>
  );
}

export function GoalDetailHeader({
  goal,
  goalCategoryMap,
  hasGoalSteps,
  isArchived,
  onBack,
  onArchive,
  onDelete,
  onRestore,
}: {
  goal: Goal;
  goalCategoryMap: Map<string, CategoryTag>;
  hasGoalSteps: boolean;
  isArchived: boolean;
  onBack: () => void;
  onArchive: (goalId: string) => Promise<void> | void;
  onDelete: () => void;
  onRestore: (goalId: string) => Promise<void> | void;
}) {
  const { dictionary, locale, scope } = useAppContext();
  const [isGoalArchiveDialogOpen, setIsGoalArchiveDialogOpen] = useState(false);
  const [isGoalRestoreDialogOpen, setIsGoalRestoreDialogOpen] = useState(false);
  const [isGoalDeleteDialogOpen, setIsGoalDeleteDialogOpen] = useState(false);
  const goalCategory = goalCategoryMap.get(goal.categoryTagId ?? '') ?? null;
  const goalDueDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );
  const isTouchComposition = useTouchComposition();

  const archiveSelectedGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsGoalArchiveDialogOpen(false);
    await onArchive(goal.id);
  }, [goal.id, onArchive, scope]);

  const deleteGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsGoalDeleteDialogOpen(false);
    await softDeleteGoal({ scope, goalId: goal.id });
    onDelete();
  }, [goal.id, onDelete, scope]);

  const restoreSelectedGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsGoalRestoreDialogOpen(false);
    await onRestore(goal.id);
  }, [goal.id, onRestore, scope]);

  const detailActions = (
    <>
      {!isArchived ? (
        <>
          <CategoryColorButton
            onAssign={(categoryTagId) =>
              scope
                ? assignGoalCategory({
                    scope,
                    goalId: goal.id,
                    categoryTagId,
                  })
                : undefined
            }
            scope={scope}
            selectedCategory={goalCategory}
            surface="goal"
          />
          <CategoryAssignmentMenu
            assignLabel={dictionary.goals.assignGoalCategory}
            clearClassName="inline-flex size-10 shrink-0 items-center justify-center rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
            clearLabel={dictionary.goals.clearGoalCategory}
            renderClearContent={() => (
              <TaskTreeClearCategoryIcon className="size-4" />
            )}
            renderTriggerContent={() => (
              <Tag aria-hidden="true" className="size-4" />
            )}
            selectedCategoryTagId={goal.categoryTagId}
            surface="goal"
            triggerClassName="inline-flex size-10 shrink-0 items-center justify-center rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:inset-ring-white/10 disabled:hover:bg-white/5 disabled:hover:text-[#cbd5e0]"
            onAssign={(categoryTagId) => {
              if (!scope) return;
              return assignGoalCategory({
                scope,
                goalId: goal.id,
                categoryTagId,
              });
            }}
          />
        </>
      ) : null}
      {!isArchived ? (
        <DatePicker
          label={dictionary.goals.dueDateLabel}
          value={goal.dueDate ? formatDateInputValue(goal.dueDate) : ''}
          variant="trigger"
          onChange={(nextValue) => {
            if (!scope) return;
            const nextDate = parseDateInputValue(nextValue);

            if (nextDate) {
              void updateGoalDueDate({
                scope,
                goalId: goal.id,
                dueDate: nextDate,
              });
            }
          }}
          onClear={() => {
            if (!scope) return;
            void updateGoalDueDate({
              scope,
              goalId: goal.id,
              dueDate: null,
            });
          }}
          renderTrigger={({ onClick, ariaLabel }) => (
            <IconButton
              aria-label={ariaLabel}
              title={dictionary.goals.assignGoalDueDate}
              className="size-10 rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
              onClick={onClick}
            >
              <CalendarDays aria-hidden="true" className="size-4" />
            </IconButton>
          )}
        />
      ) : null}
      {!isArchived ? (
        <IconButton
          aria-label={dictionary.goals.completeGoal}
          className="size-10 rounded-md inset-ring-hairline inset-ring-[#f0c38e]/25 bg-[#f0c38e]/10 text-[#f7d7ad] hover:bg-[#f0c38e]/18 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          onClick={() => setIsGoalArchiveDialogOpen(true)}
        >
          <Archive aria-hidden="true" className="size-4" />
        </IconButton>
      ) : (
        <IconButton
          aria-label={dictionary.goals.restoreGoal}
          className="size-10 rounded-md inset-ring-hairline inset-ring-[#f0c38e]/25 bg-[#f0c38e]/10 text-[#f7d7ad] hover:bg-[#f0c38e]/18 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          onClick={() => setIsGoalRestoreDialogOpen(true)}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
        </IconButton>
      )}
      <IconButton
        aria-label={dictionary.goals.deleteGoal}
        className="size-10 rounded-md inset-ring-hairline inset-ring-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/18 hover:text-rose-50 focus-visible:outline-rose-200"
        onClick={() =>
          hasGoalSteps ? setIsGoalDeleteDialogOpen(true) : void deleteGoal()
        }
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </IconButton>
    </>
  );

  return (
    <>
      <header className="flex flex-col gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2 sm:px-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          <GoalTitleEditor goal={goal} />
          {goalCategory && !goalCategory.useOwnName ? (
            <span
              className="inline-flex min-h-10 max-w-full shrink-0 items-center rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-3 py-1 text-sm font-medium text-[#f7e8ce] shadow-sm shadow-[#253241]/10"
              style={
                {
                  '--chip-edge': toAlphaColor(goalCategory.colorHex, 0.6),
                  backgroundColor: toAlphaColor(goalCategory.colorHex, 0.14),
                } as CSSProperties
              }
            >
              <span className="truncate">{goalCategory.name}</span>
            </span>
          ) : null}
          {goal.dueDate ? (
            <span className="inline-flex min-h-10 max-w-full shrink-0 items-center gap-1.5 rounded-full inset-ring-hairline inset-ring-white/15 bg-white/5 px-3 py-1 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#253241]/10">
              <CalendarDays
                aria-hidden="true"
                className="size-3.5 opacity-70"
              />
              <span className="truncate">
                {goalDueDateFormatter.format(parseLocalDateKey(goal.dueDate))}
              </span>
            </span>
          ) : null}
          {isTouchComposition ? (
            <GoalDetailActionsSheet>{detailActions}</GoalDetailActionsSheet>
          ) : (
            detailActions
          )}
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {dictionary.goals.backToGoalGroups}
        </button>
      </header>

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmTone="primary"
        confirmLabel={dictionary.goals.completeGoal}
        description={dictionary.goals.confirmCompleteGoal}
        open={isGoalArchiveDialogOpen}
        title={dictionary.goals.completeGoal}
        onClose={() => setIsGoalArchiveDialogOpen(false)}
        onConfirm={() => void archiveSelectedGoal()}
      />
      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmTone="primary"
        confirmLabel={dictionary.goals.restoreGoal}
        description={dictionary.goals.confirmRestoreGoal}
        open={isGoalRestoreDialogOpen}
        title={dictionary.goals.restoreGoal}
        onClose={() => setIsGoalRestoreDialogOpen(false)}
        onConfirm={() => void restoreSelectedGoal()}
      />

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.goals.confirmDeleteGoal}
        open={isGoalDeleteDialogOpen}
        title={dictionary.goals.deleteGoal}
        onClose={() => setIsGoalDeleteDialogOpen(false)}
        onConfirm={() => void deleteGoal()}
      />
    </>
  );
}

function GoalTitleEditor({ goal }: { goal: Goal }) {
  const { dictionary, scope } = useAppContext();
  const {
    flush: flushTitle,
    setText: setTitle,
    text: editableTitle,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope),
    onSave: async (nextTitle) => {
      if (!scope) return;
      if (nextTitle.normalize('NFC').trim().length === 0) {
        setTitle(goal.title);
        return;
      }

      await updateGoalTitle({
        scope,
        goalId: goal.id,
        title: nextTitle,
      });
    },
    value: goal.title,
  });
  const titleMeasurement = editableTitle || ' ';

  return (
    <span className="relative inline-block min-w-0 max-w-full shrink align-middle">
      <span
        aria-hidden="true"
        className="invisible block max-w-full overflow-hidden whitespace-pre rounded-md px-2 py-1 text-2xl font-semibold"
      >
        {titleMeasurement}
      </span>
      <Input
        aria-label={dictionary.goals.renameGoal}
        className="absolute inset-0 h-full w-full rounded-md bg-transparent px-2 py-1 text-2xl font-semibold text-[#fff9f2] outline-none transition focus:bg-white/[0.04] focus:inset-ring-hairline focus:inset-ring-[#f0c38e]/35"
        value={editableTitle}
        onBlur={() => void flushTitle()}
        onChange={(event) => setTitle(event.target.value.toUpperCase())}
      />
    </span>
  );
}
