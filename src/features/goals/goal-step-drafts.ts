import type { AppScopeId, GoalStep } from '@/lib/domain';
import { createId } from '@/lib/domain';
import type { VisibleGoalStepRow } from './goal-step-tree';

export interface GoalStepDraft extends GoalStep {
  beforeGoalStepId: string | null;
  isDraft: true;
  afterGoalStepId: string | null;
  isPersisting?: boolean;
}

export type GoalStepSurfaceRow = VisibleGoalStepRow & {
  goalStep: VisibleGoalStepRow['goalStep'] | GoalStepDraft;
};

export function createGoalStepDraft({
  categoryTagId = null,
  goalId,
  parentId,
  scopeId,
  afterGoalStepId = null,
}: {
  categoryTagId?: string | null;
  goalId: string;
  parentId: string | null;
  scopeId: AppScopeId;
  afterGoalStepId?: string | null;
}): GoalStepDraft {
  const now = new Date().toISOString();

  return {
    id: createId(),
    scopeId,
    goalId,
    parentId,
    text: '',
    completed: false,
    ignored: false,
    markLevel: 0,
    bold: false,
    priority: false,
    collapsed: false,
    categoryTagId,
    scheduledDate: null,
    sortRank: 'draft',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: now,
    isDraft: true,
    afterGoalStepId,
    beforeGoalStepId: null,
  };
}

function findGoalStepSubtreeEndIndex(
  rows: GoalStepSurfaceRow[],
  startIndex: number,
): number {
  const startDepth = rows[startIndex]?.depth ?? 0;
  let index = startIndex + 1;

  while (index < rows.length && rows[index].depth > startDepth) {
    index += 1;
  }

  return index;
}

function insertGoalStepDraftRow(
  currentRows: GoalStepSurfaceRow[],
  draft: GoalStepDraft,
): GoalStepSurfaceRow[] {
  const nextRows = [...currentRows];

  if (nextRows.some((row) => row.goalStep.id === draft.id)) {
    return nextRows;
  }

  if (draft.beforeGoalStepId) {
    const nextSiblingIndex = nextRows.findIndex(
      (row) => row.goalStep.id === draft.beforeGoalStepId,
    );

    if (nextSiblingIndex !== -1) {
      const nextSibling = nextRows[nextSiblingIndex];
      nextRows.splice(nextSiblingIndex, 0, {
        goalStep: draft,
        depth: nextSibling.depth,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: nextSibling.isFirstSibling,
        isLastSibling: false,
      });
      return nextRows;
    }
  }

  if (draft.parentId === null && draft.afterGoalStepId === null) {
    return nextRows.concat({
      goalStep: draft,
      depth: 0,
      childCount: 0,
      hasChildren: false,
      isFirstSibling: nextRows.filter((row) => row.depth === 0).length === 0,
      isLastSibling: true,
    });
  }

  if (draft.afterGoalStepId) {
    let previousSiblingIndex = -1;

    for (const [index, row] of nextRows.entries()) {
      const rowGoalStep = row.goalStep;

      if (
        rowGoalStep.id === draft.afterGoalStepId ||
        ('isDraft' in rowGoalStep &&
          rowGoalStep.afterGoalStepId === draft.afterGoalStepId &&
          rowGoalStep.parentId === draft.parentId)
      ) {
        previousSiblingIndex = index;
      }
    }

    if (previousSiblingIndex !== -1) {
      const previousSibling = nextRows[previousSiblingIndex];

      nextRows.splice(
        findGoalStepSubtreeEndIndex(nextRows, previousSiblingIndex),
        0,
        {
          goalStep: draft,
          depth: previousSibling.depth,
          childCount: 0,
          hasChildren: false,
          isFirstSibling: false,
          isLastSibling: previousSibling.isLastSibling,
        },
      );

      return nextRows;
    }
  }

  if (draft.parentId) {
    const parentIndex = nextRows.findIndex(
      (row) => row.goalStep.id === draft.parentId,
    );

    if (parentIndex !== -1) {
      const parentRow = nextRows[parentIndex];
      const isFirstChild = !parentRow.hasChildren;

      nextRows[parentIndex] = {
        ...parentRow,
        childCount: parentRow.childCount + 1,
        hasChildren: true,
      };

      if (parentRow.goalStep.collapsed) {
        return nextRows;
      }

      nextRows.splice(findGoalStepSubtreeEndIndex(nextRows, parentIndex), 0, {
        goalStep: draft,
        depth: parentRow.depth + 1,
        childCount: 0,
        hasChildren: false,
        isFirstSibling: isFirstChild,
        isLastSibling: true,
      });
    }
  }

  return nextRows;
}

export function insertGoalStepDraftRows(
  rows: VisibleGoalStepRow[],
  drafts: GoalStepDraft[],
): GoalStepSurfaceRow[] {
  const persistedIds = new Set(rows.map((row) => row.goalStep.id));
  const pendingDrafts = drafts.filter((draft) => !persistedIds.has(draft.id));

  return pendingDrafts.reduce<GoalStepSurfaceRow[]>(
    (currentRows, draft) => insertGoalStepDraftRow(currentRows, draft),
    rows.map((row) => ({ ...row })) as GoalStepSurfaceRow[],
  );
}

export function collectDeletedGoalStepRowIds(
  rows: GoalStepSurfaceRow[],
  goalStepId: string,
): Set<string> {
  const deletedIds = new Set<string>();
  const startIndex = rows.findIndex((row) => row.goalStep.id === goalStepId);

  if (startIndex === -1) {
    deletedIds.add(goalStepId);
    return deletedIds;
  }

  const rootDepth = rows[startIndex].depth;

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];

    if (index > startIndex && row.depth <= rootDepth) {
      break;
    }

    deletedIds.add(row.goalStep.id);
  }

  return deletedIds;
}

export function pruneGoalStepDrafts(
  drafts: GoalStepDraft[],
  deletedIds: ReadonlySet<string>,
): GoalStepDraft[] {
  const prunedIds = collectPrunedGoalStepDraftIds(drafts, deletedIds);

  return drafts.filter((draft) => !prunedIds.has(draft.id));
}

export function collectPrunedGoalStepDraftIds(
  drafts: GoalStepDraft[],
  deletedIds: ReadonlySet<string>,
): Set<string> {
  const prunedIds = new Set(deletedIds);
  let didAddPrunedDraft = true;

  while (didAddPrunedDraft) {
    didAddPrunedDraft = false;

    for (const draft of drafts) {
      if (
        !prunedIds.has(draft.id) &&
        (prunedIds.has(draft.parentId ?? '') ||
          prunedIds.has(draft.afterGoalStepId ?? '') ||
          prunedIds.has(draft.beforeGoalStepId ?? ''))
      ) {
        prunedIds.add(draft.id);
        didAddPrunedDraft = true;
      }
    }
  }

  return new Set(
    drafts.filter((draft) => prunedIds.has(draft.id)).map((draft) => draft.id),
  );
}

export function applyPendingGoalStepRowState(
  rows: GoalStepSurfaceRow[],
  pendingDeletedGoalStepIds: ReadonlySet<string>,
  pendingCollapsedGoalStepIds: ReadonlySet<string>,
): GoalStepSurfaceRow[] {
  const nextRows: GoalStepSurfaceRow[] = [];
  let hiddenBelowDepth: number | null = null;

  for (const row of rows) {
    if (hiddenBelowDepth !== null && row.depth > hiddenBelowDepth) {
      continue;
    }

    hiddenBelowDepth = null;

    if (pendingDeletedGoalStepIds.has(row.goalStep.id)) {
      hiddenBelowDepth = row.depth;
      continue;
    }

    if (pendingCollapsedGoalStepIds.has(row.goalStep.id)) {
      nextRows.push({
        ...row,
        goalStep: { ...row.goalStep, collapsed: true },
      });
      hiddenBelowDepth = row.depth;
      continue;
    }

    nextRows.push(row);
  }

  return nextRows;
}
