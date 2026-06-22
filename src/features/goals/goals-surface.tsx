'use client';

import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TaskTreeEditableRow, TreeListPanel } from '@/components/app';
import { ConfirmationDialog, IconButton, Input } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import {
  assignGoalStepCategory,
  createGoal,
  createGoalStep,
  createGoalStepChild,
  indentGoalStep,
  outdentGoalStep,
  reorderGoalStep,
  softDeleteGoal,
  softDeleteGoalStep,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  toggleGoalStepPriority,
  updateGoalStepText,
  updateGoalTitle,
} from '@/lib/db';
import type { Goal } from '@/lib/domain';
import { createId, sortByRank } from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';

const goalStepInputSelector = '[data-goal-step-input="true"]';

export function GoalsSurface() {
  const { dictionary, scope } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalIdSearchParam = searchParams.get('goal');
  const [selectedGoalIdOverride, setSelectedGoalIdOverride] = useState<
    string | null | undefined
  >(undefined);
  const selectedGoalId = selectedGoalIdOverride ?? goalIdSearchParam;
  const shortGoals = useGoals(scope, 'short');
  const mediumGoals = useGoals(scope, 'medium');
  const longGoals = useGoals(scope, 'long');
  const nowGoals = useGoals(scope, 'now');
  const categoryTags = useCategoryTags(scope, 'goals');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));
  const goals = useMemo(
    () =>
      sortByRank([...shortGoals, ...mediumGoals, ...longGoals, ...nowGoals]),
    [longGoals, mediumGoals, nowGoals, shortGoals],
  );
  const selectedGoal = selectedGoalId
    ? (goals.find((goal) => goal.id === selectedGoalId) ?? null)
    : null;
  const selectedGoalStepRows = useGoalStepTree(scope, selectedGoal?.id ?? null);

  useEffect(() => {
    const clearNavigationOverride = () => {
      setSelectedGoalIdOverride(undefined);
    };

    window.addEventListener('popstate', clearNavigationOverride);

    return () => {
      window.removeEventListener('popstate', clearNavigationOverride);
    };
  }, []);

  if (!scope) {
    return null;
  }

  function openGoal(goalId: string) {
    setSelectedGoalIdOverride(goalId);
    router.push(`/goals?goal=${encodeURIComponent(goalId)}`);
  }

  function closeGoal() {
    setSelectedGoalIdOverride(null);
    router.push('/goals');
  }

  async function createGoalCard() {
    const activeScope = scope;

    if (!activeScope) {
      return;
    }

    const goal = await createGoal({
      scope: activeScope,
      category: 'now',
      title: dictionary.goals.newGroupName.toUpperCase(),
    });
    openGoal(goal.id);
  }

  return (
    <section className="grid gap-5 pt-4 sm:pt-5 lg:pt-6">
      {selectedGoal ? (
        <GoalDetailHeader
          goal={selectedGoal}
          hasGoalSteps={selectedGoalStepRows.length > 0}
          onBack={closeGoal}
          onDelete={closeGoal}
        />
      ) : null}

      {selectedGoal ? (
        <GoalDetailCard
          categoryTagMap={categoryTagMap}
          goal={selectedGoal}
          goalStepRows={selectedGoalStepRows}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              className="group flex min-h-32 items-center rounded-[1.25rem] bg-white/[0.055] p-5 text-left shadow-[0_12px_30px_rgba(8,6,20,0.1)] ring-1 ring-white/[0.075] transition hover:-translate-y-0.5 hover:bg-white/[0.085] hover:ring-[#f0c38e]/30 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
              onClick={() => openGoal(goal.id)}
            >
              <span className="min-w-0 truncate text-xl font-semibold leading-tight text-[#fff9f2] transition group-hover:text-[#f8dfbd]">
                {goal.title || dictionary.goals.newGroupName}
              </span>
            </button>
          ))}

          <button
            type="button"
            aria-label={dictionary.goals.createGoalGroup}
            className="group flex min-h-32 flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-[#f0c38e]/42 bg-[#f0c38e]/[0.035] p-5 text-center text-[#f7d7ad] shadow-inner transition hover:-translate-y-0.5 hover:border-[#f0c38e]/70 hover:bg-[#f0c38e]/[0.075] hover:text-[#fff9f2] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onClick={() => void createGoalCard()}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#f0c38e]/12 ring-1 ring-[#f0c38e]/28 transition group-hover:bg-[#f0c38e]/18 group-hover:ring-[#f0c38e]/44">
              <Plus aria-hidden="true" className="size-5" />
            </span>
            <span className="text-sm font-semibold">
              {dictionary.goals.newGroupCard}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}

function GoalDetailHeader({
  goal,
  hasGoalSteps,
  onBack,
  onDelete,
}: {
  goal: Goal;
  hasGoalSteps: boolean;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { dictionary, scope } = useAppContext();
  const [isGoalDeleteDialogOpen, setIsGoalDeleteDialogOpen] = useState(false);

  const deleteGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsGoalDeleteDialogOpen(false);
    await softDeleteGoal({ scope, goalId: goal.id });
    onDelete();
  }, [goal.id, onDelete, scope]);

  return (
    <>
      <header className="flex flex-col gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-0">
        <div className="flex min-w-0 items-center gap-2">
          <GoalTitleEditor goal={goal} />
          <IconButton
            aria-label={dictionary.goals.deleteGoal}
            className="size-10 rounded-md border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/18 hover:text-rose-50 focus-visible:outline-rose-200"
            onClick={() =>
              hasGoalSteps ? setIsGoalDeleteDialogOpen(true) : void deleteGoal()
            }
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#312c51]/10 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {dictionary.goals.backToGoalGroups}
        </button>
      </header>

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
  const saveTitle = useCallback(
    async (nextTitle: string) => {
      if (!scope) {
        return;
      }

      await updateGoalTitle({
        scope,
        goalId: goal.id,
        title: nextTitle,
      });
    },
    [goal.id, scope],
  );
  const {
    flush: flushTitle,
    setText: setTitle,
    text: editableTitle,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope),
    onSave: async (nextTitle) => {
      if (nextTitle.normalize('NFC').trim().length === 0) {
        setTitle(goal.title);
        return;
      }

      await saveTitle(nextTitle);
    },
    value: goal.title,
  });
  const titleMirrorText = editableTitle.length > 0 ? editableTitle : ' ';

  return (
    <span className="inline-grid min-w-0 max-w-full shrink overflow-hidden">
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 h-10 min-w-0 overflow-hidden whitespace-pre px-3 text-xl font-semibold"
      >
        {titleMirrorText}
      </span>
      <Input
        aria-label={dictionary.goals.renameGoal}
        className="col-start-1 row-start-1 h-10 w-full min-w-0 max-w-full rounded-md bg-white/[0.045] px-3 py-0 text-xl font-semibold text-[#fff9f2] shadow-sm ring-1 ring-white/[0.07] outline-none transition focus:bg-white/[0.07] focus:ring-[#f0c38e]/35"
        placeholder={dictionary.goals.goalTitlePlaceholder}
        size={1}
        value={editableTitle}
        onBlur={() => void flushTitle()}
        onChange={(event) => setTitle(event.target.value.toUpperCase())}
      />
    </span>
  );
}

function GoalDetailCard({
  categoryTagMap,
  goal,
  goalStepRows,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  goal: Goal;
  goalStepRows: VisibleGoalStepRow[];
}) {
  const { dictionary, scope } = useAppContext();
  const visibleGoalStepIds = useMemo(
    () => goalStepRows.map((row) => row.goalStep.id),
    [goalStepRows],
  );
  const {
    clearSelection,
    isSelected,
    isSelectionMode,
    selectedCount,
    selectedIds,
    toggleSelect,
  } = useTreeSelection(visibleGoalStepIds);

  const deleteSelectedGoalStep = useCallback(
    async (goalStepId: string) => {
      if (!scope) return;
      await softDeleteGoalStep({ scope, goalStepId });
    },
    [scope],
  );
  const assignSelectedGoalStepCategory = useCallback(
    async (goalStepId: string, categoryTagId: string | null) => {
      if (!scope) return;
      await assignGoalStepCategory({ scope, goalStepId, categoryTagId });
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
    assignSelectedItemCategory: assignSelectedGoalStepCategory,
    clearSelection,
    deleteSelectedItem: deleteSelectedGoalStep,
    selectedIds,
  });

  const createRootGoalStep = useCallback(async () => {
    if (!scope) {
      return;
    }

    await createGoalStep({ scope, goalId: goal.id });
  }, [goal.id, scope]);

  return (
    <section
      aria-label={goal.title}
      className="flex min-h-0 flex-col rounded-[1.25rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(8,6,20,0.16)] ring-1 ring-white/[0.07] sm:p-4"
    >
      <TreeListPanel
        addLabel={dictionary.goals.addStep}
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
        emptyLabel={dictionary.goals.emptyCategory}
        hasRows={goalStepRows.length > 0}
        isSelectionMode={isSelectionMode}
        onAddRoot={createRootGoalStep}
        onClearSelection={clearSelection}
        persistenceErrorLabel={dictionary.dayEditor.saveFailed}
        surface="none"
      >
        {goalStepRows.map((row) => (
          <GoalStepRow
            key={row.goalStep.id}
            categoryTagMap={categoryTagMap}
            goalId={goal.id}
            isSelected={isSelected(row.goalStep.id)}
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

function GoalStepRow({
  categoryTagMap,
  goalId,
  isSelected,
  isSelectionMode,
  row,
  onBulkAssignCategory,
  onBulkDelete,
  onToggleSelect,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  goalId: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: VisibleGoalStepRow;
  onBulkAssignCategory: (categoryTagId: string | null) => Promise<void>;
  onBulkDelete: () => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const { goalStep, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  if (!scope) {
    return null;
  }

  return (
    <TaskTreeEditableRow
      categoryTagId={goalStep.categoryTagId}
      categoryTagMap={categoryTagMap}
      checked={goalStep.completed}
      collapsed={goalStep.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-goal-step-input"
      inputSelector={goalStepInputSelector}
      isFirstSibling={isFirstSibling}
      isLastSibling={isLastSibling}
      itemId={goalStep.id}
      labels={{
        ...dictionary.dayEditor,
        cancel: dictionary.actions.cancel,
        delete: dictionary.actions.delete,
      }}
      priority={goalStep.priority}
      selection={{
        isSelected,
        isSelectionMode,
        onBulkAssignCategory,
        onBulkDelete,
        onToggle: (shiftKey) => onToggleSelect(goalStep.id, shiftKey),
      }}
      surface="goals"
      text={goalStep.text}
      onAssignCategory={(categoryTagId) =>
        assignGoalStepCategory({
          scope,
          goalStepId: goalStep.id,
          categoryTagId,
        })
      }
      onCreateChild={async () => {
        await createGoalStepChild({
          scope,
          goalId,
          parentGoalStepId: goalStep.id,
        });
      }}
      onCreateSibling={async () => {
        const newGoalStepId = createId();
        const newStep = await createGoalStep({
          scope,
          goalId,
          id: newGoalStepId,
          parentId: goalStep.parentId,
          afterGoalStepId: goalStep.id,
        });
        return newStep.id;
      }}
      onDelete={() => softDeleteGoalStep({ scope, goalStepId: goalStep.id })}
      onIndent={() => indentGoalStep({ scope, goalStepId: goalStep.id })}
      onMoveDown={() =>
        reorderGoalStep({
          scope,
          goalStepId: goalStep.id,
          direction: 'down',
        })
      }
      onMoveUp={() =>
        reorderGoalStep({
          scope,
          goalStepId: goalStep.id,
          direction: 'up',
        })
      }
      onOutdent={() => outdentGoalStep({ scope, goalStepId: goalStep.id })}
      onSaveText={(text) =>
        updateGoalStepText({ scope, goalStepId: goalStep.id, text })
      }
      onToggleChecked={() =>
        toggleGoalStepChecked({ scope, goalStepId: goalStep.id })
      }
      onToggleCollapsed={() =>
        toggleGoalStepCollapsed({ scope, goalStepId: goalStep.id })
      }
      onTogglePriority={() =>
        toggleGoalStepPriority({ scope, goalStepId: goalStep.id })
      }
    />
  );
}
