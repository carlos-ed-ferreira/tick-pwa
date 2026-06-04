'use client';

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
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
  ensureDefaultNowGoal,
  indentGoalStep,
  mergeGoalsInCategory,
  outdentGoalStep,
  reorderGoalStep,
  softDeleteGoal,
  softDeleteGoalStep,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  updateGoalStepText,
  updateGoalTitle,
} from '@/lib/db';
import type { Goal, GoalCategory } from '@/lib/domain';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';

const goalStepInputSelector = '[data-goal-step-input="true"]';
const goalCategories: GoalCategory[] = ['short', 'medium', 'long'];
type GoalsView = 'index' | 'future' | 'now';

export function GoalsSurface() {
  const { dictionary, scope } = useAppContext();
  const [view, setView] = useState<GoalsView>('index');
  const categoryTags = useCategoryTags(scope, 'goals');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));

  if (!scope) {
    return null;
  }

  return (
    <section className="calendar-shell flex min-h-[70vh] flex-col overflow-hidden">
      <header className="calendar-header-panel flex flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6">
        {view === 'index' ? (
          <div className="grid gap-1">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              {dictionary.goals.title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[#d8d0e8]">
              {dictionary.goals.nowDescription}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <h2 className="text-2xl font-semibold sm:text-3xl">
                {view === 'future'
                  ? dictionary.goals.futureTitle
                  : dictionary.goals.nowTitle}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-[#d8d0e8]">
                {view === 'future'
                  ? dictionary.goals.futureDescription
                  : dictionary.goals.nowDescription}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] shadow-sm shadow-[#312c51]/10 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
              onClick={() => setView('index')}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {dictionary.goals.backToGoalGroups}
            </button>
          </div>
        )}
      </header>

      <div className="grid gap-4 p-4 sm:p-5 lg:p-6">
        {view === 'index' ? <GoalGroupPicker onSelect={setView} /> : null}

        {view === 'future' ? (
          <FutureGoalsView categoryTagMap={categoryTagMap} />
        ) : null}

        {view === 'now' ? (
          <NowGoalsView categoryTagMap={categoryTagMap} />
        ) : null}
      </div>
    </section>
  );
}

function GoalGroupPicker({
  onSelect,
}: {
  onSelect: (view: GoalsView) => void;
}) {
  const { dictionary } = useAppContext();
  const cards = [
    {
      view: 'future' as const,
      title: dictionary.goals.futureTitle,
      description: dictionary.goals.introFutureDescription,
    },
    {
      view: 'now' as const,
      title: dictionary.goals.nowTitle,
      description: dictionary.goals.introNowDescription,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cards.map((card) => (
        <button
          key={card.view}
          type="button"
          className="card-surface-soft group flex min-h-44 items-center justify-between gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#f0c38e]/38 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={() => onSelect(card.view)}
        >
          <span className="grid gap-2">
            <span className="text-xl font-semibold text-[#fff9f2]">
              {card.title}
            </span>
            <span className="max-w-md text-sm leading-6 text-[#d8d0e8]">
              {card.description}
            </span>
          </span>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[#f0c38e]/24 bg-[#f0c38e]/10 text-[#f0c38e] transition group-hover:border-[#f0c38e]/40 group-hover:bg-[#f0c38e]/16">
            <ChevronRight aria-hidden="true" className="size-5" />
          </span>
        </button>
      ))}
    </div>
  );
}

function FutureGoalsView({
  categoryTagMap,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
}) {
  const { dictionary } = useAppContext();

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

function NowGoalsView({
  categoryTagMap,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
}) {
  const { dictionary, scope, requestSync } = useAppContext();
  const { addNowGoal, newNowGoalTitle, nowTitle } = dictionary.goals;
  const goals = useGoals(scope, 'now');
  const defaultGoal = goals[0] ?? null;
  const customGoals = goals.slice(1);

  useEffect(() => {
    if (!scope) {
      return;
    }

    void (async () => {
      await ensureDefaultNowGoal({
        scope,
        title: nowTitle,
      });
      await requestSync();
    })();
  }, [nowTitle, requestSync, scope]);

  const createNowGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    await createGoal({
      scope,
      category: 'now',
      afterGoalId: goals.at(-1)?.id ?? null,
      title: newNowGoalTitle,
    });
    await requestSync();
  }, [goals, newNowGoalTitle, requestSync, scope]);

  return (
    <section className="grid gap-4">
      {defaultGoal ? (
        <GoalCard
          categoryTagMap={categoryTagMap}
          goal={defaultGoal}
          label={nowTitle}
          title={nowTitle}
        />
      ) : null}

      {customGoals.map((goal) => (
        <GoalCard
          key={goal.id}
          categoryTagMap={categoryTagMap}
          goal={goal}
          label={goal.title || newNowGoalTitle}
          title={goal.title}
          titleEditable
          deletable
        />
      ))}

      <button
        type="button"
        className="flex min-h-14 w-fit items-center gap-2 rounded-full border border-[#f0c38e]/22 bg-[#f0c38e]/10 px-4 py-2 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:border-[#f0c38e]/36 hover:bg-[#f0c38e]/16 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
        onClick={() => void createNowGoal()}
      >
        <Plus aria-hidden="true" className="size-4" />
        {addNowGoal}
      </button>
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
  const { scope } = useAppContext();
  const goals = useGoals(scope, category);
  const primaryGoal = goals[0] ?? null;

  return (
    <GoalCard
      category={category}
      categoryTagMap={categoryTagMap}
      goal={primaryGoal}
      label={label}
      title={label}
      mergeDuplicateGoals={goals.length > 1}
    />
  );
}

function GoalCard({
  category,
  categoryTagMap,
  deletable = false,
  goal,
  label,
  mergeDuplicateGoals = false,
  title,
  titleEditable = false,
}: {
  category?: GoalCategory;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  deletable?: boolean;
  goal: Goal | null;
  label: string;
  mergeDuplicateGoals?: boolean;
  title: string;
  titleEditable?: boolean;
}) {
  const { dictionary, scope, requestSync } = useAppContext();
  const [isGoalDeleteDialogOpen, setIsGoalDeleteDialogOpen] = useState(false);
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
  const saveTitle = useCallback(
    async (nextTitle: string) => {
      if (!scope || !primaryGoal) {
        return;
      }

      await updateGoalTitle({
        scope,
        goalId: primaryGoal.id,
        title: nextTitle,
      });
      await requestSync();
    },
    [primaryGoal, requestSync, scope],
  );
  const {
    flush: flushTitle,
    setText: setTitle,
    text: editableTitle,
  } = useDebouncedInlineEdit({
    enabled: Boolean(scope && primaryGoal && titleEditable),
    onSave: saveTitle,
    value: title,
  });

  useEffect(() => {
    if (!scope || !category || !mergeDuplicateGoals) {
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
  }, [category, mergeDuplicateGoals, requestSync, scope]);

  const createRootGoalStep = useCallback(async () => {
    if (!scope) {
      return;
    }

    const activeGoal =
      primaryGoal ?? (category ? await createGoal({ scope, category }) : null);

    if (!activeGoal) {
      return;
    }

    await createGoalStep({ scope, goalId: activeGoal.id });
    await requestSync();
  }, [category, primaryGoal, requestSync, scope]);

  const deleteGoal = useCallback(async () => {
    if (!scope || !primaryGoal) {
      return;
    }

    setIsGoalDeleteDialogOpen(false);
    await softDeleteGoal({ scope, goalId: primaryGoal.id });
    await requestSync();
  }, [primaryGoal, requestSync, scope]);

  return (
    <section
      aria-label={label}
      className="card-surface flex flex-col p-3 sm:p-4"
    >
      <div className="flex items-center gap-2 pb-3">
        {titleEditable ? (
          <Input
            aria-label={dictionary.goals.renameNowGoal}
            placeholder={dictionary.goals.nowGoalPlaceholder}
            value={editableTitle}
            className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-base font-semibold outline-none transition focus:bg-surface focus:shadow-sm"
            onBlur={() => void flushTitle()}
            onChange={(event) => setTitle(event.target.value)}
          />
        ) : (
          <h3 className="min-w-0 flex-1 truncate px-2 py-2 text-base font-semibold">
            {title}
          </h3>
        )}
        {deletable ? (
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
        ) : null}
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
