'use client';

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  IndentDecrease,
  IndentIncrease,
  Plus,
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
  updateGoalStepText,
  updateGoalTitle,
} from '@/lib/db';
import type { Goal } from '@/lib/domain';
import { sortByRank } from '@/lib/domain';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';

const goalStepInputSelector = '[data-goal-step-input="true"]';

export function GoalsSurface() {
  const { dictionary, scope, requestSync } = useAppContext();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
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

  if (!scope) {
    return null;
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

    await requestSync();
    setSelectedGoalId(goal.id);
  }

  return (
    <section className="grid gap-5">
      <header className="flex items-center justify-between px-1 sm:px-0">
        <h2 className="text-2xl font-semibold text-[#fff9f2] sm:text-3xl">
          {dictionary.goals.title}
        </h2>

        {selectedGoal ? (
          <button
            type="button"
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#312c51]/10 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
            onClick={() => setSelectedGoalId(null)}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {dictionary.goals.backToGoalGroups}
          </button>
        ) : null}
      </header>

      {selectedGoal ? (
        <GoalDetailCard
          categoryTagMap={categoryTagMap}
          goal={selectedGoal}
          onDelete={() => setSelectedGoalId(null)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              className="group flex min-h-32 items-center rounded-[1.25rem] bg-white/[0.055] p-5 text-left shadow-[0_12px_30px_rgba(8,6,20,0.1)] ring-1 ring-white/[0.075] transition hover:-translate-y-0.5 hover:bg-white/[0.085] hover:ring-[#f0c38e]/30 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
              onClick={() => setSelectedGoalId(goal.id)}
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

function GoalDetailCard({
  categoryTagMap,
  goal,
  onDelete,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  goal: Goal;
  onDelete: () => void;
}) {
  const { dictionary, scope, requestSync } = useAppContext();
  const [isGoalDeleteDialogOpen, setIsGoalDeleteDialogOpen] = useState(false);
  const goalStepRows = useGoalStepTree(scope, goal.id);
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
      await requestSync();
    },
    [requestSync, scope],
  );
  const assignSelectedGoalStepCategory = useCallback(
    async (goalStepId: string, categoryTagId: string | null) => {
      if (!scope) return;
      await assignGoalStepCategory({ scope, goalStepId, categoryTagId });
      await requestSync();
    },
    [requestSync, scope],
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
      await requestSync();
    },
    [goal.id, requestSync, scope],
  );
  const {
    flush: flushTitle,
    setText: setTitle,
    text: editableTitle,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope),
    onSave: saveTitle,
    value: goal.title,
  });

  const createRootGoalStep = useCallback(async () => {
    if (!scope) {
      return;
    }

    await createGoalStep({ scope, goalId: goal.id });
    await requestSync();
  }, [goal.id, requestSync, scope]);

  const deleteGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsGoalDeleteDialogOpen(false);
    await softDeleteGoal({ scope, goalId: goal.id });
    onDelete();
    await requestSync();
  }, [goal.id, onDelete, requestSync, scope]);

  return (
    <section
      aria-label={goal.title}
      className="flex min-h-0 flex-col rounded-[1.25rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(8,6,20,0.16)] ring-1 ring-white/[0.07] sm:p-4"
    >
      <div className="flex items-center gap-2 pb-3">
        <Input
          aria-label={dictionary.goals.renameGoal}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-base font-semibold text-[#fff9f2] outline-none transition focus:bg-surface focus:shadow-sm"
          placeholder={dictionary.goals.goalTitlePlaceholder}
          value={editableTitle}
          onBlur={() => void flushTitle()}
          onChange={(event) => setTitle(event.target.value.toUpperCase())}
        />

        <IconButton
          aria-label={dictionary.goals.deleteGoal}
          onClick={() =>
            goalStepRows.length > 0
              ? setIsGoalDeleteDialogOpen(true)
              : void deleteGoal()
          }
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </IconButton>
      </div>

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

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.goals.confirmDeleteGoal}
        open={isGoalDeleteDialogOpen}
        title={dictionary.goals.deleteGoal}
        onClose={() => setIsGoalDeleteDialogOpen(false)}
        onConfirm={() => void deleteGoal()}
      />
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
  const { dictionary, scope, requestSync } = useAppContext();
  const { goalStep, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const focusAfterCreate = useFocusAfterCreate();
  const selectedCategory = goalStep.categoryTagId
    ? (categoryTagMap.get(goalStep.categoryTagId) ?? null)
    : null;
  const saveText = useCallback(
    async (nextText: string) => {
      if (!scope) {
        return;
      }

      await updateGoalStepText({
        scope,
        goalStepId: goalStep.id,
        text: nextText,
      });
      await requestSync();
    },
    [goalStep.id, requestSync, scope],
  );
  const {
    flush: flushText,
    setText,
    text,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope),
    onSave: saveText,
    value: goalStep.text,
  });

  const createSibling = useCallback(async () => {
    if (!scope) {
      return null;
    }

    await flushText();
    const newStep = await createGoalStep({
      scope,
      goalId,
      parentId: goalStep.parentId,
      afterGoalStepId: goalStep.id,
    });
    await requestSync();
    return newStep.id;
  }, [flushText, goalId, goalStep.id, goalStep.parentId, requestSync, scope]);

  const createChild = useCallback(async () => {
    if (!scope) {
      return;
    }

    await flushText();
    await createGoalStepChild({
      scope,
      goalId,
      parentGoalStepId: goalStep.id,
    });
    await requestSync();
  }, [flushText, goalId, goalStep.id, requestSync, scope]);

  const requestDelete = useCallback(async () => {
    if (!scope) {
      return;
    }

    if (requiresDeleteConfirmation(text)) {
      setIsDeleteDialogOpen(true);
      return;
    }

    await softDeleteGoalStep({ scope, goalStepId: goalStep.id });
    await requestSync();
  }, [goalStep.id, requestSync, scope, text]);

  const confirmDelete = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsDeleteDialogOpen(false);
    await softDeleteGoalStep({ scope, goalStepId: goalStep.id });
    await requestSync();
  }, [goalStep.id, requestSync, scope]);

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!scope) {
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await toggleGoalStepChecked({ scope, goalStepId: goalStep.id });
      await requestSync();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const newStepId = await createSibling();
      if (newStepId) {
        focusAfterCreate(newStepId);
      }
      return;
    }

    if (event.key === 'Tab') {
      const goalStepInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(goalStepInputSelector),
      );
      const currentIndex = goalStepInputs.indexOf(event.currentTarget);
      const targetInput =
        goalStepInputs[currentIndex + (event.shiftKey ? -1 : 1)];

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
      await softDeleteGoalStep({ scope, goalStepId: goalStep.id });
      await requestSync();
    }
  }

  return (
    <>
      <TaskTreeRowLayout
        categoryColorHex={selectedCategory?.colorHex}
        depth={depth}
        isSelected={isSelected}
      >
        <TaskTreeCollapseButton
          collapseLabel={dictionary.dayEditor.collapseItem}
          expandLabel={dictionary.dayEditor.expandItem}
          hasChildren={hasChildren}
          isCollapsed={goalStep.collapsed}
          onClick={() => {
            if (scope) {
              void (async () => {
                await toggleGoalStepCollapsed({
                  scope,
                  goalStepId: goalStep.id,
                });
                await requestSync();
              })();
            }
          }}
        />

        <Checkbox
          aria-label={dictionary.dayEditor.toggleItem}
          checked={goalStep.completed}
          onChange={() => {
            if (scope) {
              void (async () => {
                await toggleGoalStepChecked({
                  scope,
                  goalStepId: goalStep.id,
                });
                await requestSync();
              })();
            }
          }}
        />

        <Input
          data-goal-step-input="true"
          data-item-id={goalStep.id}
          value={text}
          placeholder={dictionary.dayEditor.itemPlaceholder}
          className={`min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm outline-none transition focus:bg-surface focus:shadow-sm ${
            goalStep.completed ? 'opacity-50' : 'text-foreground'
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
                void (async () => {
                  await reorderGoalStep({
                    scope,
                    goalStepId: goalStep.id,
                    direction: 'up',
                  });
                  await requestSync();
                })();
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
                void (async () => {
                  await reorderGoalStep({
                    scope,
                    goalStepId: goalStep.id,
                    direction: 'down',
                  });
                  await requestSync();
                })();
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
                void (async () => {
                  await indentGoalStep({ scope, goalStepId: goalStep.id });
                  await requestSync();
                })();
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
                void (async () => {
                  await outdentGoalStep({ scope, goalStepId: goalStep.id });
                  await requestSync();
                })();
              }
            }}
          >
            <IndentDecrease aria-hidden="true" className="size-4" />
          </IconButton>
          <TaskTreeSelectionButton
            deselectLabel={dictionary.dayEditor.deselectItem}
            isSelected={isSelected}
            selectLabel={dictionary.dayEditor.selectItem}
            onToggle={(shiftKey) => onToggleSelect(goalStep.id, shiftKey)}
          />
          <CategoryAssignmentMenu
            assignLabel={dictionary.dayEditor.assignCategory}
            clearLabel={dictionary.dayEditor.clearCategory}
            disabled={isSelectionMode && !isSelected}
            selectedCategoryTagId={goalStep.categoryTagId}
            surface="goals"
            onAssign={(categoryTagId) => {
              if (isSelectionMode) {
                return onBulkAssignCategory(categoryTagId);
              }

              if (scope) {
                return assignGoalStepCategory({
                  scope,
                  goalStepId: goalStep.id,
                  categoryTagId,
                }).then(async () => {
                  await requestSync();
                });
              }

              return Promise.resolve();
            }}
          />
          <IconButton
            aria-label={dictionary.dayEditor.deleteItem}
            disabled={isSelectionMode && !isSelected}
            onClick={() =>
              isSelectionMode ? onBulkDelete() : void requestDelete()
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
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
