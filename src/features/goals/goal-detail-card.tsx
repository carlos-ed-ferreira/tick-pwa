'use client';

import { ChevronRight, LayoutList } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildCompletionStateSettings,
  TaskTreeBulkActions,
  TaskTreeCategoryChip,
  TaskTreeCategoryTabs,
  TaskTreeRowActionsMenu,
  TreeListPanel,
} from '@/components/app';
import { Checkbox } from '@/components/ui';
import {
  defaultCategoryViewMode,
  useCategoryViewMode,
  type CategoryViewMode,
} from '@/hooks/use-category-view-mode';
import { useCompletionStates } from '@/hooks/use-completion-states';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import { useTaskTreeRowActionPreferences } from '@/hooks/use-task-tree-row-action-visibility';
import { toAlphaColor } from '@/lib/color';
import { formatCountLabel, formatSelectionLabel } from '@/lib/i18n';
import {
  assignGoalStepCategory,
  softDeleteGoalStep,
  setGoalStepsCompleted,
  toggleGoalStepBold,
  toggleGoalStepCollapsed,
  toggleGoalStepPriority,
} from '@/lib/db';
import type {
  CategoryTag,
  Goal,
  GoalStep,
  TaskCompletionValues,
} from '@/lib/domain';
import {
  ALL_CATEGORY_TAB_ID,
  buildCategoryTabs,
  filterRowsByCategoryTab,
  getSelectionCompletionValues,
  resolveActiveCategoryTab,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import {
  GoalStepDraft,
  GoalStepSurfaceRow,
  createGoalStepDraft,
  insertGoalStepDraftRows,
  collectDeletedGoalStepRowIds,
  pruneGoalStepDrafts,
  collectPrunedGoalStepDraftIds,
  applyPendingGoalStepRowState,
} from './goal-step-drafts';
import { GoalStepRow } from './goal-step-row';

export function ArchivedGoalDetailCard({
  categoryTagMap,
  goal,
  goalStepRows,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  goal: Goal;
  goalStepRows: VisibleGoalStepRow[];
}) {
  const { dictionary } = useAppContext();

  return (
    <section
      aria-label={goal.title}
      className="flex min-h-0 flex-col rounded-[0.75rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(5,8,13,0.16)] sm:p-4"
      data-archived-goal-read-only="true"
    >
      {goalStepRows.length > 0 ? (
        <div className="grid gap-1" role="list">
          {goalStepRows.map(({ depth, goalStep, hasChildren }) => {
            const category = categoryTagMap.get(goalStep.categoryTagId ?? '');

            return (
              <div
                key={goalStep.id}
                className="relative flex min-h-11 min-w-0 items-center gap-1 rounded-lg px-0"
                role="listitem"
                style={{
                  paddingLeft: `${depth * 14}px`,
                  backgroundColor: category
                    ? toAlphaColor(category.colorHex, 0.12)
                    : undefined,
                  boxShadow: goalStep.priority
                    ? 'inset 4px 0 0 0 rgba(240, 195, 142, 1)'
                    : undefined,
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center text-[#7b8da0]"
                >
                  {hasChildren ? <ChevronRight className="size-4" /> : null}
                </span>
                <Checkbox
                  aria-label={dictionary.goalStepEditor.toggleItem}
                  checked={goalStep.completed}
                  className="disabled:cursor-default disabled:opacity-100"
                  disabled
                  indeterminate={goalStep.ignored}
                />
                <span
                  className={`min-w-0 flex-1 px-2 text-sm leading-5 ${
                    goalStep.completed || goalStep.ignored
                      ? 'text-[#7b8da0] opacity-75'
                      : 'text-[#fff9f2]'
                  } ${goalStep.bold ? 'font-bold' : 'font-normal'}`}
                >
                  {goalStep.text}
                </span>
                {category ? (
                  <TaskTreeCategoryChip
                    colorHex={category.colorHex}
                    name={category.name}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="flex min-h-36 items-center justify-center px-4 text-center text-sm text-[#909cab]">
          {dictionary.goals.emptyGoal}
        </p>
      )}
    </section>
  );
}

export function GoalDetailCard({
  categoryTags,
  categoryTagMap,
  goal,
  goalStepRows,
}: {
  categoryTags: readonly CategoryTag[];
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  goal: Goal;
  goalStepRows: VisibleGoalStepRow[];
}) {
  const { dictionary, scope } = useAppContext();
  const [draftGoalSteps, setDraftGoalSteps] = useState<GoalStepDraft[]>([]);
  const {
    actionPreferences,
    applyActionPreferencesToOtherSurface,
    setActionPreferences,
  } = useTaskTreeRowActionPreferences('goal_step');
  const deletedDraftGoalStepIdsRef = useRef(new Set<string>());
  const [pendingCollapsedGoalStepIds, setPendingCollapsedGoalStepIds] =
    useState(() => new Set<string>());
  const [pendingDeletedGoalStepIds, setPendingDeletedGoalStepIds] = useState(
    () => new Set<string>(),
  );
  const goalStepRowsWithDrafts = useMemo(
    () => insertGoalStepDraftRows(goalStepRows, draftGoalSteps),
    [draftGoalSteps, goalStepRows],
  );
  const displayGoalStepRows = useMemo(
    () =>
      applyPendingGoalStepRowState(
        goalStepRowsWithDrafts,
        pendingDeletedGoalStepIds,
        pendingCollapsedGoalStepIds,
      ),
    [
      goalStepRowsWithDrafts,
      pendingCollapsedGoalStepIds,
      pendingDeletedGoalStepIds,
    ],
  );
  const { setViewMode, viewMode } = useCategoryViewMode('goal_step');
  const { completionSettings, setCompletionSettings } =
    useCompletionStates('goal_step');
  const [requestedCategoryTabId, setRequestedCategoryTabId] =
    useState(ALL_CATEGORY_TAB_ID);
  const categoryTabs = useMemo(
    () =>
      buildCategoryTabs({
        allLabel: dictionary.goals.categoryTabAll,
        categoryTags,
        getCategoryTagId: (row: GoalStepSurfaceRow) =>
          row.goalStep.categoryTagId,
        rows: displayGoalStepRows,
        uncategorizedLabel: dictionary.goals.categoryTabUncategorized,
      }),
    [
      categoryTags,
      dictionary.goals.categoryTabAll,
      dictionary.goals.categoryTabUncategorized,
      displayGoalStepRows,
    ],
  );
  const isTabView = viewMode === 'tabs' && categoryTabs.length > 1;
  const activeCategoryTab = isTabView
    ? resolveActiveCategoryTab(categoryTabs, requestedCategoryTabId)
    : null;
  const visibleGoalStepRows = useMemo(
    () =>
      activeCategoryTab
        ? filterRowsByCategoryTab({
            activeTabId: activeCategoryTab.id,
            getCategoryTagId: (row: GoalStepSurfaceRow) =>
              row.goalStep.categoryTagId,
            rows: displayGoalStepRows,
            tabs: categoryTabs,
          })
        : displayGoalStepRows,
    [activeCategoryTab, categoryTabs, displayGoalStepRows],
  );
  const visibleGoalStepIds = useMemo(
    () =>
      visibleGoalStepRows
        .filter((row) => !('isDraft' in row.goalStep))
        .map((row) => row.goalStep.id),
    [visibleGoalStepRows],
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
      const deletedIds = collectDeletedGoalStepRowIds(
        goalStepRowsWithDrafts,
        goalStepId,
      );
      const prunedDraftIds = collectPrunedGoalStepDraftIds(
        draftGoalSteps,
        deletedIds,
      );
      for (const draftId of prunedDraftIds) {
        deletedDraftGoalStepIdsRef.current.add(draftId);
      }

      setPendingDeletedGoalStepIds((currentIds) => {
        const nextIds = new Set(currentIds);
        deletedIds.forEach((id) => nextIds.add(id));
        return nextIds;
      });

      try {
        await softDeleteGoalStep({ scope, goalStepId });
        await Promise.all(
          [...prunedDraftIds].map((draftId) =>
            softDeleteGoalStep({ scope, goalStepId: draftId }),
          ),
        );
        setDraftGoalSteps((currentDrafts) =>
          pruneGoalStepDrafts(currentDrafts, deletedIds),
        );
        window.setTimeout(() => {
          setPendingDeletedGoalStepIds((currentIds) => {
            const nextIds = new Set(currentIds);
            deletedIds.forEach((id) => nextIds.delete(id));
            return nextIds;
          });
        }, 0);
      } catch (error) {
        prunedDraftIds.forEach((id) =>
          deletedDraftGoalStepIdsRef.current.delete(id),
        );
        setPendingDeletedGoalStepIds((currentIds) => {
          const nextIds = new Set(currentIds);
          deletedIds.forEach((id) => nextIds.delete(id));
          return nextIds;
        });
        throw error;
      }
    },
    [draftGoalSteps, goalStepRowsWithDrafts, scope],
  );
  const toggleCollapsedGoalStep = useCallback(
    async (goalStep: GoalStep) => {
      if (!scope) return;

      if (!goalStep.collapsed) {
        setPendingCollapsedGoalStepIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(goalStep.id);
          return nextIds;
        });
      }

      try {
        await toggleGoalStepCollapsed({
          scope,
          goalStepId: goalStep.id,
        });
        window.setTimeout(() => {
          setPendingCollapsedGoalStepIds((currentIds) => {
            const nextIds = new Set(currentIds);
            nextIds.delete(goalStep.id);
            return nextIds;
          });
        }, 0);
      } catch (error) {
        setPendingCollapsedGoalStepIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(goalStep.id);
          return nextIds;
        });
        throw error;
      }
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
      return null;
    }

    const nextDraft = createGoalStepDraft({
      categoryTagId: activeCategoryTab?.categoryTagId ?? null,
      goalId: goal.id,
      parentId: null,
      scopeId: scope.id,
    });
    setDraftGoalSteps((currentDrafts) => [...currentDrafts, nextDraft]);
    return nextDraft.id;
  }, [activeCategoryTab, goal.id, scope]);
  const selectedGoalSteps = goalStepRows
    .map((row) => row.goalStep)
    .filter((goalStep) => selectedIds.has(goalStep.id));
  const allSelectedPriority =
    selectedGoalSteps.length > 0 &&
    selectedGoalSteps.every((goalStep) => goalStep.priority);
  const allSelectedBold =
    selectedGoalSteps.length > 0 &&
    selectedGoalSteps.every((goalStep) => goalStep.bold);
  const selectedCompletionValues = getSelectionCompletionValues(
    selectedGoalSteps.map((goalStep) => ({
      completed: goalStep.completed,
      ignored: goalStep.ignored,
      markLevel: goalStep.markLevel,
    })),
  );
  const toggleSelectedGoalStepsCompleted = useCallback(
    async (nextValues: TaskCompletionValues) => {
      if (!scope) {
        return;
      }

      await setGoalStepsCompleted({
        scope,
        goalStepIds: [...selectedIds],
        completed: nextValues.completed,
        ignored: nextValues.ignored,
        markLevel: nextValues.markLevel,
      });
    },
    [scope, selectedIds],
  );
  const selectedLabel = formatSelectionLabel({
    count: selectedCount,
    plural: dictionary.goalStepEditor.itemsSelected,
    singular: dictionary.goalStepEditor.itemSelected,
  });

  return (
    <section
      aria-label={goal.title}
      className="flex min-h-0 flex-col gap-3 rounded-[0.75rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(5,8,13,0.16)] sm:p-4"
    >
      {isTabView ? (
        <TaskTreeCategoryTabs
          activeTabId={activeCategoryTab?.id ?? null}
          label={dictionary.goals.categoryTabs}
          tabs={categoryTabs}
          onSelect={setRequestedCategoryTabId}
        />
      ) : null}
      <TreeListPanel
        addLabel={dictionary.goals.addStep}
        bulkDeleteDialog={{
          cancelLabel: dictionary.actions.cancel,
          confirmLabel: dictionary.actions.delete,
          description: formatCountLabel({
            count: selectedCount,
            plural: dictionary.goalStepEditor.confirmBulkDeleteItems,
            singular: dictionary.goalStepEditor.confirmBulkDeleteItem,
          }),
          open: isBulkDeleteDialogOpen,
          title: dictionary.goalStepEditor.bulkDeleteItems,
          onClose: closeBulkDeleteDialog,
          onConfirm: () => void confirmBulkDelete(),
        }}
        clearSelectionLabel={dictionary.goalStepEditor.clearSelection}
        emptyLabel={dictionary.goals.emptyGoal}
        hasRows={visibleGoalStepRows.length > 0}
        isSelectionMode={isSelectionMode}
        onAddRoot={createRootGoalStep}
        onClearSelection={clearSelection}
        selectionActions={
          <TaskTreeBulkActions
            actionPreferences={actionPreferences}
            allBold={allSelectedBold}
            allPriority={allSelectedPriority}
            completionSettings={completionSettings}
            completionValues={selectedCompletionValues}
            labels={{
              bold: dictionary.goalStepEditor.bulkBold,
              category: dictionary.goalStepEditor.bulkCategory,
              clearCategory: dictionary.goalStepEditor.clearCategory,
              delete: dictionary.goalStepEditor.bulkDelete,
              priority: dictionary.goalStepEditor.bulkPriority,
              selected: selectedLabel,
              mark: dictionary.goalStepEditor.bulkMark,
            }}
            surface="goal_step"
            onAssignCategory={assignBulkCategory}
            onDelete={openBulkDeleteDialog}
            onToggleChecked={toggleSelectedGoalStepsCompleted}
            onToggleBold={async () => {
              if (!scope) {
                return;
              }

              const nextBold = !allSelectedBold;
              await Promise.all(
                selectedGoalSteps
                  .filter((goalStep) => goalStep.bold !== nextBold)
                  .map((goalStep) =>
                    toggleGoalStepBold({
                      scope,
                      goalStepId: goalStep.id,
                    }),
                  ),
              );
            }}
            onTogglePriority={async () => {
              if (!scope) {
                return;
              }

              const nextPriority = !allSelectedPriority;
              await Promise.all(
                selectedGoalSteps
                  .filter((goalStep) => goalStep.priority !== nextPriority)
                  .map((goalStep) =>
                    toggleGoalStepPriority({
                      scope,
                      goalStepId: goalStep.id,
                    }),
                  ),
              );
            }}
          />
        }
        surface="none"
        toolbarActions={
          <TaskTreeRowActionsMenu
            labels={{
              actions: {
                add: dictionary.goalStepEditor.addChild,
                bold: dictionary.goalStepEditor.bulkBold,
                category: dictionary.goalStepEditor.bulkCategory,
                clearCategory: dictionary.goalStepEditor.clearCategory,
                delete: dictionary.goalStepEditor.bulkDelete,
                drag: dictionary.goalStepEditor.dragAndDrop,
                indent: dictionary.goalStepEditor.indentItem,
                moveDown: dictionary.goalStepEditor.moveItemDown,
                moveUp: dictionary.goalStepEditor.moveItemUp,
                outdent: dictionary.goalStepEditor.outdentItem,
                priority: dictionary.goalStepEditor.bulkPriority,
                scheduledTime: dictionary.goalStepEditor.itemTime,
                scheduledDate: dictionary.goalStepEditor.itemDate,
              },
              applyToOtherSurface:
                dictionary.goalStepEditor.applyToOtherSurface,
              close: dictionary.actions.cancel,
              configure: dictionary.goalStepEditor.configurePreferences,
              hidden: dictionary.goalStepEditor.actionHidden,
              inline: dictionary.goalStepEditor.actionOnRow,
              menu: dictionary.goalStepEditor.actionInMenu,
              reset: dictionary.goalStepEditor.resetPreferences,
              title: dictionary.goalStepEditor.preferencesTitle,
              visible: dictionary.goalStepEditor.actionVisible,
            }}
            settings={[
              {
                choices: [
                  {
                    label: dictionary.goals.viewModeList,
                    value: 'list',
                  },
                  {
                    label: dictionary.goals.viewModeTabs,
                    value: 'tabs',
                  },
                ],
                defaultValue: defaultCategoryViewMode,
                icon: LayoutList,
                key: 'viewMode',
                label: dictionary.goals.viewMode,
                value: viewMode,
                onChange: (nextViewMode) =>
                  setViewMode(nextViewMode as CategoryViewMode),
              },
              ...buildCompletionStateSettings({
                completionSettings,
                labels: {
                  completionIgnoredState:
                    dictionary.goalStepEditor.completionIgnoredState,
                  completionLevels: dictionary.goalStepEditor.completionLevels,
                  settingDisabled: dictionary.goalStepEditor.settingDisabled,
                  settingEnabled: dictionary.goalStepEditor.settingEnabled,
                },
                onChange: setCompletionSettings,
              }),
            ]}
            showScheduledTime={false}
            showScheduledDate={true}
            value={actionPreferences}
            onApplyToOtherSurface={(nextPreferences) =>
              void applyActionPreferencesToOtherSurface(nextPreferences)
            }
            onChange={setActionPreferences}
          />
        }
      >
        {visibleGoalStepRows.map((row) => (
          <GoalStepRow
            key={row.goalStep.id}
            actionPreferences={actionPreferences}
            categoryTagMap={categoryTagMap}
            completionSettings={completionSettings}
            deletedDraftGoalStepIdsRef={deletedDraftGoalStepIdsRef}
            goalId={goal.id}
            isSelected={isSelected(row.goalStep.id)}
            isSelectionMode={isSelectionMode}
            row={row}
            rows={visibleGoalStepRows}
            onBulkAssignCategory={assignBulkCategory}
            onBulkDelete={openBulkDeleteDialog}
            onBulkToggleChecked={toggleSelectedGoalStepsCompleted}
            onDeleteGoalStep={deleteSelectedGoalStep}
            onToggleCollapsedGoalStep={toggleCollapsedGoalStep}
            onToggleSelect={toggleSelect}
            setDraftGoalSteps={setDraftGoalSteps}
          />
        ))}
      </TreeListPanel>
    </section>
  );
}
