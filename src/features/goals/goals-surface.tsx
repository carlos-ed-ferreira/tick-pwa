'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Checkbox, ConfirmationDialog, IconButton } from '@/components/ui';
import { CategoryAssignmentMenu, useCategoryTags } from '@/features/categories';
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

function toAlphaColor(hex: string, opacity: number): string {
  const normalizedHex = hex.replace('#', '');

  if (normalizedHex.length !== 3 && normalizedHex.length !== 6) {
    return hex;
  }

  const expandedHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalizedHex;
  const red = Number.parseInt(expandedHex.slice(0, 2), 16);
  const green = Number.parseInt(expandedHex.slice(2, 4), 16);
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

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
  const { dictionary, scope } = useAppContext();
  const goals = useGoals(scope, category);
  const primaryGoal = goals[0] ?? null;
  const goalStepRows = useGoalStepTree(scope, primaryGoal?.id ?? null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const isSelectionMode = selectedIds.size > 0;

  const toggleSelect = useCallback(
    (stepId: string, shiftKey: boolean) => {
      if (shiftKey && lastSelectedId) {
        const allIds = goalStepRows.map((r) => r.goalStep.id);
        const from = allIds.indexOf(lastSelectedId);
        const to = allIds.indexOf(stepId);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedIds(
            (prev) => new Set([...prev, ...allIds.slice(start, end + 1)]),
          );
        }
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(stepId)) next.delete(stepId);
          else next.add(stepId);
          return next;
        });
        setLastSelectedId(stepId);
      }
    },
    [lastSelectedId, goalStepRows],
  );

  const confirmBulkDelete = useCallback(async () => {
    if (!scope) return;
    for (const id of selectedIds) {
      await softDeleteGoalStep({ scope, goalStepId: id });
    }
    setSelectedIds(new Set());
    setLastSelectedId(null);
    setIsBulkDeleteDialogOpen(false);
  }, [scope, selectedIds]);

  const handleBulkAssignCategory = useCallback(
    async (categoryTagId: string | null) => {
      if (!scope) return;
      for (const id of selectedIds) {
        await assignGoalStepCategory({ scope, goalStepId: id, categoryTagId });
      }
      setSelectedIds(new Set());
      setLastSelectedId(null);
    },
    [scope, selectedIds],
  );

  useEffect(() => {
    if (!scope || goals.length < 2) {
      return;
    }

    void mergeGoalsInCategory({ scope, category });
  }, [category, goals.length, scope]);

  const createRootGoalStep = useCallback(async () => {
    if (!scope) {
      return;
    }

    const goal = primaryGoal ?? (await createGoal({ scope, category }));
    await createGoalStep({ scope, goalId: goal.id });
  }, [category, primaryGoal, scope]);

  return (
    <section
      aria-label={label}
      className="flex min-h-80 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4"
    >
      <h2 className="pb-3 text-base font-semibold">{label}</h2>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background/50 p-2">
        {goalStepRows.length === 0 ? (
          <button
            type="button"
            className="flex min-h-32 w-full items-center justify-center rounded-md border border-dashed border-border px-4 text-sm text-muted transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={createRootGoalStep}
          >
            {dictionary.goals.emptyCategory}
          </button>
        ) : (
          <div className="grid gap-1">
            {goalStepRows.map((row) => (
              <GoalStepRow
                key={row.goalStep.id}
                categoryTagMap={categoryTagMap}
                goalId={primaryGoal?.id ?? row.goalStep.goalId}
                isSelected={selectedIds.has(row.goalStep.id)}
                isSelectionMode={isSelectionMode}
                row={row}
                onBulkAssignCategory={handleBulkAssignCategory}
                onBulkDelete={() => setIsBulkDeleteDialogOpen(true)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
        {goalStepRows.length > 0 && (
          <div className="flex items-center justify-between px-1 pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 text-sm text-muted transition hover:border-foreground/40 hover:text-foreground"
              onClick={createRootGoalStep}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {dictionary.goals.addStep}
            </button>
            {isSelectionMode && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 text-sm text-muted transition hover:border-foreground/40 hover:text-foreground"
                onClick={() => {
                  setSelectedIds(new Set());
                  setLastSelectedId(null);
                }}
              >
                <X aria-hidden="true" className="size-3.5" />
                {dictionary.dayEditor.clearSelection}
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.dayEditor.confirmBulkDeleteItems.replace(
          '{count}',
          String(selectedIds.size),
        )}
        open={isBulkDeleteDialogOpen}
        title={dictionary.dayEditor.bulkDeleteItems}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
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
  const { dictionary, scope } = useAppContext();
  const { goalStep, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [text, setText] = useState(goalStep.text);
  const selectedCategory = goalStep.categoryTagId
    ? (categoryTagMap.get(goalStep.categoryTagId) ?? null)
    : null;

  const flushText = useCallback(async () => {
    if (!scope || text === goalStep.text) {
      return;
    }

    await updateGoalStepText({ scope, goalStepId: goalStep.id, text });
  }, [goalStep.id, goalStep.text, scope, text]);

  useEffect(() => {
    if (!scope || text === goalStep.text) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateGoalStepText({ scope, goalStepId: goalStep.id, text });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [goalStep.id, goalStep.text, scope, text]);

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
    return newStep.id;
  }, [flushText, goalId, goalStep.id, goalStep.parentId, scope]);

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
  }, [flushText, goalId, goalStep.id, scope]);

  const requestDelete = useCallback(async () => {
    if (!scope) {
      return;
    }

    if (requiresDeleteConfirmation(text)) {
      setIsDeleteDialogOpen(true);
      return;
    }

    await softDeleteGoalStep({ scope, goalStepId: goalStep.id });
  }, [goalStep.id, scope, text]);

  const confirmDelete = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsDeleteDialogOpen(false);
    await softDeleteGoalStep({ scope, goalStepId: goalStep.id });
  }, [goalStep.id, scope]);

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!scope) {
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await toggleGoalStepChecked({ scope, goalStepId: goalStep.id });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const newStepId = await createSibling();
      if (newStepId) {
        let retries = 0;
        const tryFocus = () => {
          const newInput = document.querySelector<HTMLInputElement>(
            `[data-item-id="${newStepId}"]`,
          );
          if (newInput) {
            newInput.focus();
          } else if (retries < 20) {
            retries++;
            window.requestAnimationFrame(tryFocus);
          }
        };
        window.requestAnimationFrame(tryFocus);
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
    }
  }

  return (
    <>
      <div
        className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-1 transition hover:bg-surface"
        style={{
          paddingLeft: `min(${depth * 16}px, 56px)`,
          backgroundColor: isSelected
            ? 'color-mix(in srgb, var(--color-foreground) 8%, transparent)'
            : selectedCategory
              ? toAlphaColor(selectedCategory.colorHex, 0.12)
              : undefined,
        }}
      >
        <IconButton
          aria-label={
            goalStep.collapsed
              ? dictionary.dayEditor.expandItem
              : dictionary.dayEditor.collapseItem
          }
          className={!hasChildren ? 'disabled:opacity-100' : ''}
          disabled={!hasChildren}
          onClick={() => {
            if (scope) {
              void toggleGoalStepCollapsed({
                scope,
                goalStepId: goalStep.id,
              });
            }
          }}
        >
          {goalStep.collapsed || !hasChildren ? (
            <ChevronRight
              aria-hidden="true"
              className={`size-4 ${hasChildren ? '' : 'opacity-45'}`}
            />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </IconButton>

        <Checkbox
          aria-label={dictionary.dayEditor.toggleItem}
          checked={goalStep.completed}
          onChange={() => {
            if (scope) {
              void toggleGoalStepChecked({
                scope,
                goalStepId: goalStep.id,
              });
            }
          }}
        />

        <input
          data-goal-step-input="true"
          data-item-id={goalStep.id}
          spellCheck={false}
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
          <span
            className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium leading-none"
            style={{
              borderColor: selectedCategory.colorHex,
              backgroundColor: toAlphaColor(selectedCategory.colorHex, 0.18),
              color: selectedCategory.colorHex,
            }}
          >
            {selectedCategory.name}
          </span>
        ) : null}

        <div className="flex shrink-0 items-center gap-0">
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
                void reorderGoalStep({
                  scope,
                  goalStepId: goalStep.id,
                  direction: 'up',
                });
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
                void reorderGoalStep({
                  scope,
                  goalStepId: goalStep.id,
                  direction: 'down',
                });
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
                void indentGoalStep({ scope, goalStepId: goalStep.id });
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
                void outdentGoalStep({ scope, goalStepId: goalStep.id });
              }
            }}
          >
            <IndentDecrease aria-hidden="true" className="size-4" />
          </IconButton>
          <button
            type="button"
            aria-label={
              isSelected
                ? dictionary.dayEditor.deselectItem
                : dictionary.dayEditor.selectItem
            }
            className="group inline-flex size-9 shrink-0 items-center justify-center rounded-md transition hover:bg-background"
            onClick={(e) => onToggleSelect(goalStep.id, e.shiftKey)}
          >
            <span
              className={`flex size-3.5 items-center justify-center rounded-full border-2 transition ${
                isSelected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-muted group-hover:border-foreground'
              }`}
            >
              {isSelected && <Check aria-hidden="true" className="size-2" />}
            </span>
          </button>
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
        </div>
      </div>

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
