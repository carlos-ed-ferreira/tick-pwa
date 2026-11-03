'use client';

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  moveTreeItemToTarget,
  TaskTreeEditableRow,
  type TaskTreeRowActionPreferences,
} from '@/components/app';
import {
  assignGoalStepCategory,
  createGoalStep,
  indentGoalStep,
  moveGoalStepToParent,
  moveGoalStepToTarget,
  outdentGoalStep,
  reorderGoalStep,
  softDeleteGoalStep,
  setGoalStepsCompleted,
  toggleGoalStepBold,
  toggleGoalStepChecked,
  toggleGoalStepPriority,
  updateGoalStepScheduledDate,
  updateGoalStepText,
} from '@/lib/db';
import type {
  GoalStep,
  TaskCompletionSettings,
  TaskCompletionValues,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import {
  GoalStepDraft,
  GoalStepSurfaceRow,
  createGoalStepDraft,
} from './goal-step-drafts';

const goalStepInputSelector = '[data-goal-step-input="true"]';

export function GoalStepRow({
  actionPreferences,
  categoryTagMap,
  completionSettings,
  deletedDraftGoalStepIdsRef,
  goalId,
  isSelected,
  isSelectionMode,
  row,
  rows,
  onBulkAssignCategory,
  onBulkDelete,
  onBulkToggleChecked,
  onDeleteGoalStep,
  onToggleCollapsedGoalStep,
  onToggleSelect,
  setDraftGoalSteps,
}: {
  actionPreferences: TaskTreeRowActionPreferences;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  completionSettings: TaskCompletionSettings;
  deletedDraftGoalStepIdsRef: MutableRefObject<Set<string>>;
  goalId: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: GoalStepSurfaceRow;
  rows: GoalStepSurfaceRow[];
  onBulkAssignCategory: (categoryTagId: string | null) => Promise<void>;
  onBulkDelete: () => void;
  onBulkToggleChecked: (nextValues: TaskCompletionValues) => Promise<void>;
  onDeleteGoalStep: (goalStepId: string) => Promise<void>;
  onToggleCollapsedGoalStep: (goalStep: GoalStep) => Promise<void>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  setDraftGoalSteps: Dispatch<SetStateAction<GoalStepDraft[]>>;
}) {
  const { dictionary, scope } = useAppContext();
  const { goalStep, depth, hasChildren } = row;
  if (!scope) {
    return null;
  }

  const isDraft = 'isDraft' in goalStep && goalStep.isDraft;
  const siblingIds = rows
    .filter((currentRow) => currentRow.goalStep.parentId === goalStep.parentId)
    .map((currentRow) => currentRow.goalStep.id);
  const siblingIndex = siblingIds.indexOf(goalStep.id);
  const isFirstVisibleSibling = siblingIndex === 0;
  const isLastVisibleSibling = siblingIndex === siblingIds.length - 1;

  async function handleMoveGoalStepToTarget({
    itemId,
    targetItemId,
    placement,
  }: {
    itemId: string;
    targetItemId: string;
    placement: 'before' | 'child' | 'after';
  }) {
    if (!scope) {
      return;
    }

    const movingGoalStep = rows.find(
      (row) => row.goalStep.id === itemId,
    )?.goalStep;
    const targetGoalStep = rows.find(
      (row) => row.goalStep.id === targetItemId,
    )?.goalStep;

    if (
      movingGoalStep &&
      'isDraft' in movingGoalStep &&
      movingGoalStep.isDraft &&
      targetGoalStep
    ) {
      const targetAncestors = new Set<string>();
      let currentParentId = targetGoalStep.parentId;

      while (currentParentId) {
        targetAncestors.add(currentParentId);
        currentParentId =
          rows.find((row) => row.goalStep.id === currentParentId)?.goalStep
            .parentId ?? null;
      }

      if (placement === 'child' && targetAncestors.has(itemId)) {
        return;
      }

      setDraftGoalSteps((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.id !== itemId
            ? draft
            : placement === 'child'
              ? {
                  ...draft,
                  afterGoalStepId: null,
                  beforeGoalStepId: null,
                  parentId: targetItemId,
                }
              : {
                  ...draft,
                  afterGoalStepId: placement === 'after' ? targetItemId : null,
                  beforeGoalStepId:
                    placement === 'before' ? targetItemId : null,
                  parentId: targetGoalStep.parentId,
                },
        ),
      );
      return;
    }

    await moveTreeItemToTarget({
      canMove: (candidate) => !('isDraft' in candidate && candidate.isDraft),
      itemId,
      items: rows.map((currentRow) => currentRow.goalStep),
      placement,
      targetItemId,
      onMoveAsChild: (movingItemId, parentGoalStepId) =>
        moveGoalStepToParent({
          scope,
          goalStepId: movingItemId,
          parentGoalStepId,
        }),
      onMoveAdjacent: (movingItemId, targetItemId, placement) =>
        moveGoalStepToTarget({
          scope,
          goalStepId: movingItemId,
          targetGoalStepId: targetItemId,
          placement,
        }),
      onReorder: (movingItemId, direction) =>
        reorderGoalStep({ scope, goalStepId: movingItemId, direction }),
    });
  }

  async function persistDraftGoalStep(text: string) {
    if (!isDraft || !scope) {
      return;
    }

    if (goalStep.isPersisting) {
      return;
    }

    setDraftGoalSteps((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === goalStep.id
          ? { ...draft, text, isPersisting: true }
          : draft,
      ),
    );

    try {
      await createGoalStep({
        scope,
        goalId,
        id: goalStep.id,
        parentId: goalStep.parentId,
        afterGoalStepId: goalStep.afterGoalStepId,
        bold: goalStep.bold,
        scheduledDate: goalStep.scheduledDate,
        text,
      });

      if (goalStep.categoryTagId) {
        await assignGoalStepCategory({
          scope,
          goalStepId: goalStep.id,
          categoryTagId: goalStep.categoryTagId,
        });
      }

      if (goalStep.beforeGoalStepId) {
        await moveGoalStepToTarget({
          scope,
          goalStepId: goalStep.id,
          targetGoalStepId: goalStep.beforeGoalStepId,
          placement: 'before',
        });
      }

      if (deletedDraftGoalStepIdsRef.current.has(goalStep.id)) {
        await softDeleteGoalStep({ scope, goalStepId: goalStep.id });
      }
    } catch (error) {
      setDraftGoalSteps((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.id === goalStep.id ? { ...draft, isPersisting: false } : draft,
        ),
      );
      throw error;
    }
  }

  function indentGoalStepItem() {
    if (!scope) {
      return;
    }

    if (!isDraft) {
      return indentGoalStep({ scope, goalStepId: goalStep.id });
    }

    const currentSiblingIndex = siblingIds.indexOf(goalStep.id);
    const previousSiblingId = siblingIds[currentSiblingIndex - 1];

    if (!previousSiblingId) {
      return;
    }

    return handleMoveGoalStepToTarget({
      itemId: goalStep.id,
      placement: 'child',
      targetItemId: previousSiblingId,
    });
  }

  function outdentGoalStepItem() {
    if (!scope) {
      return;
    }

    if (!isDraft) {
      return outdentGoalStep({ scope, goalStepId: goalStep.id });
    }

    if (!goalStep.parentId) {
      return;
    }

    return handleMoveGoalStepToTarget({
      itemId: goalStep.id,
      placement: 'after',
      targetItemId: goalStep.parentId,
    });
  }

  function moveGoalStepItem(direction: 'down' | 'up') {
    if (!scope) {
      return;
    }

    const targetGoalStepId =
      siblingIds[siblingIndex + (direction === 'up' ? -1 : 1)];

    if (!targetGoalStepId) {
      return;
    }

    const targetGoalStep = rows.find(
      (currentRow) => currentRow.goalStep.id === targetGoalStepId,
    )?.goalStep;

    if (isDraft) {
      return handleMoveGoalStepToTarget({
        itemId: goalStep.id,
        placement: direction === 'up' ? 'before' : 'after',
        targetItemId: targetGoalStepId,
      });
    }

    if (
      targetGoalStep &&
      'isDraft' in targetGoalStep &&
      targetGoalStep.isDraft
    ) {
      return handleMoveGoalStepToTarget({
        itemId: targetGoalStep.id,
        placement: direction === 'up' ? 'after' : 'before',
        targetItemId: goalStep.id,
      });
    }

    return reorderGoalStep({ scope, goalStepId: goalStep.id, direction });
  }

  function toggleGoalStepItemCollapsed() {
    if (!scope) {
      return;
    }

    if (!isDraft) {
      return onToggleCollapsedGoalStep(goalStep);
    }

    setDraftGoalSteps((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === goalStep.id
          ? { ...draft, collapsed: !draft.collapsed }
          : draft,
      ),
    );
  }

  return (
    <TaskTreeEditableRow
      actionPreferences={actionPreferences}
      bold={goalStep.bold}
      categoryTagId={goalStep.categoryTagId}
      categoryTagMap={categoryTagMap}
      checked={goalStep.completed}
      completionSettings={completionSettings}
      ignored={goalStep.ignored}
      markLevel={goalStep.markLevel}
      collapsed={goalStep.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-goal-step-input"
      inputSelector={goalStepInputSelector}
      isFirstSibling={isFirstVisibleSibling}
      isLastSibling={isLastVisibleSibling}
      itemId={goalStep.id}
      labels={{
        ...dictionary.goalStepEditor,
        cancel: dictionary.actions.cancel,
        delete: dictionary.actions.delete,
      }}
      parentId={goalStep.parentId}
      priority={goalStep.priority}
      scheduledDate={goalStep.scheduledDate}
      showScheduledDate
      selection={
        isDraft
          ? undefined
          : {
              isSelected,
              isSelectionMode,
              onBulkAssignCategory,
              onBulkDelete,
              onBulkToggleChecked,
              onToggle: (shiftKey) => onToggleSelect(goalStep.id, shiftKey),
            }
      }
      siblingIds={siblingIds}
      surface="goal_step"
      text={goalStep.text}
      isDraft={isDraft}
      onAssignCategory={(categoryTagId) =>
        assignGoalStepCategory({
          scope,
          goalStepId: goalStep.id,
          categoryTagId,
        })
      }
      onCreateChild={async () => {
        const newDraft = createGoalStepDraft({
          goalId,
          parentId: goalStep.id,
          scopeId: scope.id,
        });
        setDraftGoalSteps((currentDrafts) => [...currentDrafts, newDraft]);
        return newDraft.id;
      }}
      onCreateSibling={async () => {
        const newDraft = createGoalStepDraft({
          goalId,
          parentId: goalStep.parentId,
          scopeId: scope.id,
          afterGoalStepId: goalStep.id,
        });
        setDraftGoalSteps((currentDrafts) => [...currentDrafts, newDraft]);
        return newDraft.id;
      }}
      onDelete={() =>
        isDraft
          ? setDraftGoalSteps((currentDrafts) =>
              currentDrafts.filter((draft) => draft.id !== goalStep.id),
            )
          : onDeleteGoalStep(goalStep.id)
      }
      onIndent={indentGoalStepItem}
      onMoveTo={handleMoveGoalStepToTarget}
      onMoveDown={() => moveGoalStepItem('down')}
      onMoveUp={() => moveGoalStepItem('up')}
      onOutdent={outdentGoalStepItem}
      onSaveDate={(scheduledDate) =>
        isDraft
          ? setDraftGoalSteps((currentDrafts) =>
              currentDrafts.map((draft) =>
                draft.id === goalStep.id ? { ...draft, scheduledDate } : draft,
              ),
            )
          : updateGoalStepScheduledDate({
              scope,
              goalStepId: goalStep.id,
              scheduledDate,
            })
      }
      onSaveText={(text) =>
        isDraft
          ? persistDraftGoalStep(text)
          : updateGoalStepText({ scope, goalStepId: goalStep.id, text })
      }
      onSetCompletion={(nextValues) =>
        isDraft
          ? Promise.resolve()
          : setGoalStepsCompleted({
              scope,
              goalStepIds: [goalStep.id],
              completed: nextValues.completed,
              ignored: nextValues.ignored,
              markLevel: nextValues.markLevel,
            })
      }
      onToggleChecked={() =>
        isDraft
          ? Promise.resolve()
          : toggleGoalStepChecked({
              scope,
              goalStepId: goalStep.id,
              completionSettings,
            })
      }
      onToggleBold={() =>
        isDraft
          ? setDraftGoalSteps((currentDrafts) =>
              currentDrafts.map((draft) =>
                draft.id === goalStep.id
                  ? { ...draft, bold: !draft.bold }
                  : draft,
              ),
            )
          : toggleGoalStepBold({ scope, goalStepId: goalStep.id })
      }
      onToggleCollapsed={toggleGoalStepItemCollapsed}
      onTogglePriority={() =>
        toggleGoalStepPriority({ scope, goalStepId: goalStep.id })
      }
    />
  );
}
