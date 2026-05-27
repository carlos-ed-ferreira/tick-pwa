'use client';

import {
  ArrowDown,
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
  assignGoalStepCategory,
  createGoal,
  createGoalStep,
  createGoalStepChild,
  indentGoalStep,
  mergeGoalsInCategory,
  outdentGoalStep,
  reorderGoalStep,
  softDeleteGoalStep,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  updateGoalStepText,
} from '@/lib/db';
import type { GoalCategory } from '@/lib/domain';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';

const goalStepInputSelector = '[data-goal-step-input="true"]';
const goalCategories: GoalCategory[] = ['short', 'medium', 'long'];

export function GoalsSurface() {
  const { dictionary, scope } = useAppContext();
  const categoryTags = useCategoryTags(scope);
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));

  if (!scope) {
    return null;
  }

  return (
    <section className="grid gap-4">
      {goalCategories.map((category) => (
        <GoalCategoryColumn
          key={category}
          categoryTagMap={categoryTagMap}
          category={category}
          label={dictionary.goals.categories[category]}
        />
      ))}
    </section>
  );
}

function GoalCategoryColumn({
  categoryTagMap,
  category,
  label,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  category: GoalCategory;
  label: string;
}) {
  const { dictionary, scope, requestSync } = useAppContext();
  const goals = useGoals(scope, category);
  const primaryGoal = goals[0] ?? null;
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

  useEffect(() => {
    if (!scope || goals.length < 2) {
      return;
    }

    void (async () => {
      try {
        await mergeGoalsInCategory({ scope, category });
        await requestSync();
      } catch (error) {
        console.error('Failed to merge goal categories.', error);
      }
    })();
  }, [category, goals.length, requestSync, scope]);

  const createRootGoalStep = useCallback(async () => {
    if (!scope) {
      return;
    }

    const goal = primaryGoal ?? (await createGoal({ scope, category }));
    await createGoalStep({ scope, goalId: goal.id });
    await requestSync();
  }, [category, primaryGoal, requestSync, scope]);

  return (
    <section
      aria-label={label}
      className="flex min-h-80 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4"
    >
      <h2 className="pb-3 text-base font-semibold">{label}</h2>

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
      >
        {goalStepRows.map((row) => (
          <GoalStepRow
            key={row.goalStep.id}
            categoryTagMap={categoryTagMap}
            goalId={primaryGoal?.id ?? row.goalStep.goalId}
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
