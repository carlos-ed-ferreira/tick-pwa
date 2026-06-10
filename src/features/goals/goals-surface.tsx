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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
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
  assignGoalCategory,
  assignGoalStepCategory,
  createCategoryTag,
  createGoal,
  createGoalStep,
  createGoalStepChild,
  indentGoalStep,
  mergeGoalsInCategoryTag,
  outdentGoalStep,
  reorderGoalStep,
  softDeleteGoalStep,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  updateCategoryTag,
  updateGoalStepText,
} from '@/lib/db';
import type { CategoryTag, Goal } from '@/lib/domain';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';

const goalStepInputSelector = '[data-goal-step-input="true"]';
const newGoalGroupColorHex = '#f0c38e';

export function GoalsSurface() {
  const { dictionary, scope, requestSync } = useAppContext();
  const [selectedCategoryTagId, setSelectedCategoryTagId] = useState<
    string | null
  >(null);
  const categoryTags = useCategoryTags(scope, 'goals');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));
  const selectedCategoryTag = selectedCategoryTagId
    ? (categoryTagMap.get(selectedCategoryTagId) ?? null)
    : null;

  if (!scope) {
    return null;
  }

  async function createGoalGroup() {
    if (!scope) {
      return;
    }

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'goals',
      name: dictionary.goals.newGroupName,
      colorHex: newGoalGroupColorHex,
    });
    await requestSync();
    setSelectedCategoryTagId(categoryTag.id);
  }

  return (
    <section className="grid gap-5">
      <header className="flex flex-col gap-4 px-1 sm:px-0">
        {selectedCategoryTag ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <GoalNameInput
                key={selectedCategoryTag.id}
                categoryTag={selectedCategoryTag}
              />
              <p className="max-w-2xl text-sm leading-6 text-[#d8d0e8]">
                {dictionary.goals.groupDetailDescription}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#312c51]/10 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
              onClick={() => setSelectedCategoryTagId(null)}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {dictionary.goals.backToGoalGroups}
            </button>
          </div>
        ) : (
          <div className="grid gap-1">
            <h2 className="text-2xl font-semibold text-[#fff9f2] sm:text-3xl">
              {dictionary.goals.title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[#d8d0e8]">
              {dictionary.goals.groupsDescription}
            </p>
          </div>
        )}
      </header>

      <div className="grid gap-4">
        {selectedCategoryTag ? (
          <GoalGroupView
            categoryTag={selectedCategoryTag}
            categoryTagMap={categoryTagMap}
          />
        ) : (
          <GoalGroupGrid
            categoryTags={categoryTags}
            onCreateGroup={() => void createGoalGroup()}
            onSelectGroup={setSelectedCategoryTagId}
          />
        )}
      </div>
    </section>
  );
}

function GoalNameInput({ categoryTag }: { categoryTag: CategoryTag }) {
  const { dictionary, scope, requestSync } = useAppContext();
  const [draftName, setDraftName] = useState(categoryTag.name);

  async function commitName() {
    if (!scope) {
      return;
    }

    const trimmed = draftName.trim();

    if (!trimmed) {
      setDraftName(categoryTag.name);
      return;
    }

    if (trimmed === categoryTag.name) {
      return;
    }

    await updateCategoryTag({
      scope,
      categoryTagId: categoryTag.id,
      name: trimmed,
    });
    await requestSync();
  }

  return (
    <Input
      aria-label={dictionary.goals.renameGoal}
      className="min-w-0 w-full border-b border-transparent bg-transparent px-0 py-0.5 text-2xl font-semibold text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] focus:border-[#f0c38e]/30 sm:text-3xl"
      placeholder={dictionary.goals.goalTitlePlaceholder}
      value={draftName}
      onBlur={() => void commitName()}
      onChange={(event) => setDraftName(event.target.value.toUpperCase())}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setDraftName(categoryTag.name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function GoalGroupGrid({
  categoryTags,
  onCreateGroup,
  onSelectGroup,
}: {
  categoryTags: CategoryTag[];
  onCreateGroup: () => void;
  onSelectGroup: (categoryTagId: string) => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categoryTags.map((categoryTag) => (
        <button
          key={categoryTag.id}
          type="button"
          className="group flex min-h-32 items-center rounded-[1.25rem] bg-white/[0.055] p-5 text-left shadow-[0_12px_30px_rgba(8,6,20,0.1)] ring-1 ring-white/[0.075] transition hover:-translate-y-0.5 hover:bg-white/[0.085] hover:ring-[#f0c38e]/30 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={() => onSelectGroup(categoryTag.id)}
        >
          <span className="min-w-0 text-xl font-semibold leading-tight text-[#fff9f2] transition group-hover:text-[#f8dfbd]">
            {categoryTag.name}
          </span>
        </button>
      ))}

      <button
        type="button"
        aria-label={dictionary.goals.createGoalGroup}
        className="group flex min-h-32 flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-[#f0c38e]/42 bg-[#f0c38e]/[0.035] p-5 text-center text-[#f7d7ad] shadow-inner transition hover:-translate-y-0.5 hover:border-[#f0c38e]/70 hover:bg-[#f0c38e]/[0.075] hover:text-[#fff9f2] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
        onClick={onCreateGroup}
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#f0c38e]/12 ring-1 ring-[#f0c38e]/28 transition group-hover:bg-[#f0c38e]/18 group-hover:ring-[#f0c38e]/44">
          <Plus aria-hidden="true" className="size-5" />
        </span>
        <span className="text-sm font-semibold">
          {dictionary.goals.newGroupCard}
        </span>
      </button>
    </div>
  );
}

function GoalGroupView({
  categoryTag,
  categoryTagMap,
}: {
  categoryTag: CategoryTag;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
}) {
  const { scope, requestSync } = useAppContext();
  const shortGoals = useGoals(scope, 'short');
  const mediumGoals = useGoals(scope, 'medium');
  const longGoals = useGoals(scope, 'long');
  const allNowGoals = useGoals(scope, 'now');
  const goalsByCategory = [
    { category: 'short' as const, goals: shortGoals },
    { category: 'medium' as const, goals: mediumGoals },
    { category: 'long' as const, goals: longGoals },
    { category: 'now' as const, goals: allNowGoals },
  ];
  const goals = goalsByCategory.flatMap(({ goals }) =>
    goals.filter((goal) => goal.categoryTagId === categoryTag.id),
  );
  const primaryGoal = goals[0] ?? null;

  useEffect(() => {
    if (!scope) {
      return;
    }

    if (goals.length <= 1) {
      return;
    }

    void (async () => {
      await mergeGoalsInCategoryTag({
        scope,
        categoryTagId: categoryTag.id,
      });
      await requestSync();
    })();
  }, [categoryTag.id, goals.length, requestSync, scope]);

  return (
    <GoalChecklistPanel
      categoryTag={categoryTag}
      categoryTagMap={categoryTagMap}
      goal={primaryGoal}
    />
  );
}

function GoalChecklistPanel({
  categoryTag,
  categoryTagMap,
  goal,
}: {
  categoryTag: CategoryTag;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  goal: Goal | null;
}) {
  const { dictionary, scope, requestSync } = useAppContext();
  const primaryGoal = goal;
  const goalStepRows = useGoalStepTree(scope, primaryGoal?.id ?? null);
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
  const createRootGoalStep = useCallback(async () => {
    if (!scope) {
      return;
    }

    const activeGoal =
      primaryGoal ??
      (await createGoal({
        scope,
        category: 'now',
        title: categoryTag.name,
      }));

    if (!primaryGoal) {
      await assignGoalCategory({
        scope,
        goalId: activeGoal.id,
        categoryTagId: categoryTag.id,
      });
    }

    await createGoalStep({ scope, goalId: activeGoal.id });
    await requestSync();
  }, [categoryTag.id, categoryTag.name, primaryGoal, requestSync, scope]);

  return (
    <section
      aria-label={categoryTag.name}
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
        surface="none"
      >
        {goalStepRows.map((row) => (
          <GoalStepRow
            key={row.goalStep.id}
            categoryTagMap={categoryTagMap}
            goalId={row.goalStep.goalId}
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
