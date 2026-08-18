'use client';

import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FolderPlus,
  GripVertical,
  LayoutList,
  MoreHorizontal,
  LogOut,
  Palette,
  Plus,
  RotateCcw,
  Tag,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DatePicker,
  dropdownJoinOverlap,
  getDropdownJoinShape,
  moveTreeItemToTarget,
  TaskTreeBulkActions,
  TaskTreeCategoryChip,
  TaskTreeCategoryTabs,
  TaskTreeClearCategoryIcon,
  TaskTreeEditableRow,
  TaskTreeRowActionsMenu,
  TreeListPanel,
  type DropdownJoinShape,
  type TaskTreeRowActionPreferences,
} from '@/components/app';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  DashedRing,
  Dialog,
  IconButton,
  Input,
  ModalActionButton,
  Tooltip,
} from '@/components/ui';
import {
  canUseOwnName,
  CategoryAssignmentMenu,
  useCategoryTags,
} from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import {
  defaultCategoryViewMode,
  useCategoryViewMode,
  type CategoryViewMode,
} from '@/hooks/use-category-view-mode';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import { useTaskTreeRowActionPreferences } from '@/hooks/use-task-tree-row-action-visibility';
import { toAlphaColor } from '@/lib/color';
import { formatCountLabel, formatSelectionLabel } from '@/lib/i18n';
import {
  formatDateInputValue,
  parseDateInputValue,
  parseLocalDateKey,
} from '@/lib/time';
import {
  assignGoalCategory,
  assignGoalGroupCategory,
  assignGoalStepCategory,
  completeGoal,
  createCategoryTag,
  createGoal,
  createGoalGroup,
  createGoalStep,
  groupGoalsTogether,
  indentGoalStep,
  moveGoalStepToParent,
  moveGoalStepToTarget,
  moveGoalAfter,
  moveGoalBefore,
  moveGoalGroupAfter,
  moveGoalGroupBefore,
  moveGoalToGroup,
  outdentGoalStep,
  reopenGoal,
  reorderGoalStep,
  softDeleteGoal,
  softDeleteGoalGroup,
  softDeleteGoalStep,
  setGoalStepsCompleted,
  toggleGoalStepBold,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  toggleGoalStepPriority,
  updateCategoryTag,
  updateGoalDueDate,
  updateGoalGroupTitle,
  updateGoalStepScheduledDate,
  updateGoalStepText,
  updateGoalTitle,
} from '@/lib/db';
import type {
  AppScope,
  AppScopeId,
  CategoryTag,
  CategoryTagSurface,
  Goal,
  GoalGroup,
  GoalStep,
  TaskCompletionValues,
} from '@/lib/domain';
import {
  ALL_CATEGORY_TAB_ID,
  buildCategoryTabs,
  createId,
  filterRowsByCategoryTab,
  getSelectionCompletionState,
  resolveActiveCategoryTab,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { VisibleGoalStepRow } from './goal-step-tree';
import { useGoalGroups } from './use-goal-groups';
import {
  getGoalStepSummary,
  type GoalStepSummary,
  useGoalStepSummaries,
} from './use-goal-step-summaries';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';

const goalStepInputSelector = '[data-goal-step-input="true"]';
const visibleCategoryLimit = 4;
const goalMenuItemClassName =
  'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#e5ebf3] transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]';
const goalMenuDangerItemClassName =
  'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-400/15 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200';

interface GoalStepDraft extends GoalStep {
  beforeGoalStepId: string | null;
  isDraft: true;
  afterGoalStepId: string | null;
  isPersisting?: boolean;
}

type GoalStepSurfaceRow = VisibleGoalStepRow & {
  goalStep: VisibleGoalStepRow['goalStep'] | GoalStepDraft;
};

function createGoalStepDraft({
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

function insertGoalStepDraftRows(
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

function collectDeletedGoalStepRowIds(
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

function pruneGoalStepDrafts(
  drafts: GoalStepDraft[],
  deletedIds: ReadonlySet<string>,
): GoalStepDraft[] {
  const prunedIds = collectPrunedGoalStepDraftIds(drafts, deletedIds);

  return drafts.filter((draft) => !prunedIds.has(draft.id));
}

function collectPrunedGoalStepDraftIds(
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

function applyPendingGoalStepRowState(
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

type DragPayload = { id: string; type: 'goal' } | { id: string; type: 'group' };
type PositionSide = 'before' | 'after';
type DragTarget =
  | { id: string; type: 'goal-combine' }
  | { id: string; side: PositionSide; type: 'goal-position' }
  | { id: string; type: 'group-combine' }
  | { id: string; side: PositionSide; type: 'group-position' }
  | { type: 'ungrouped' };
type PointerDragState = {
  offsetX: number;
  offsetY: number;
  payload: DragPayload;
  pointerId: number;
};
type PendingGoalCombine = {
  sourceGoalId: string;
  targetGoalId: string;
};

function getProgressTone(summary: GoalStepSummary) {
  const ratio =
    summary.itemCount > 0 ? summary.completedCount / summary.itemCount : 0;

  if (ratio >= 1 && summary.itemCount > 0) {
    return {
      badgeStyle: {
        color: '#15803d',
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
        '--chip-edge': 'rgba(34, 197, 94, 0.22)',
      },
      fillStyle: {
        background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
        boxShadow: '0 0 14px rgba(34, 197, 94, 0.28)',
      },
      trackStyle: { backgroundColor: 'rgba(34, 197, 94, 0.16)' },
    };
  }

  if (ratio > 0) {
    return {
      badgeStyle: {
        color: '#b45309',
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        '--chip-edge': 'rgba(245, 158, 11, 0.24)',
      },
      fillStyle: {
        background: 'linear-gradient(90deg, #fcd34d 0%, #f59e0b 100%)',
        boxShadow: '0 0 14px rgba(245, 158, 11, 0.24)',
      },
      trackStyle: { backgroundColor: 'rgba(245, 158, 11, 0.16)' },
    };
  }

  return {
    badgeStyle: {
      color: 'var(--muted)',
      backgroundColor: 'rgba(113, 113, 122, 0.12)',
      '--chip-edge': 'rgba(113, 113, 122, 0.18)',
    },
    fillStyle: {
      background: 'linear-gradient(90deg, #a1a1aa 0%, #71717a 100%)',
      boxShadow: 'none',
    },
    trackStyle: { backgroundColor: 'rgba(113, 113, 122, 0.14)' },
  };
}

function isCategoryComplete(summary: GoalStepSummary, categoryTagId: string) {
  const categorySummary = summary.categorySummaries.get(categoryTagId);

  return Boolean(
    categorySummary &&
    categorySummary.itemCount > 0 &&
    categorySummary.completedCount >= categorySummary.itemCount,
  );
}

function isSameDragPayload(
  first: DragPayload | null,
  second: DragPayload,
): boolean {
  return Boolean(first && first.type === second.type && first.id === second.id);
}

function isSameDragTarget(
  first: DragTarget | null,
  second: DragTarget,
): boolean {
  if (!first || first.type !== second.type) {
    return false;
  }

  if (first.type === 'ungrouped' || second.type === 'ungrouped') {
    return first.type === second.type;
  }

  if (first.id !== second.id) {
    return false;
  }

  if ('side' in first || 'side' in second) {
    return 'side' in first && 'side' in second && first.side === second.side;
  }

  return true;
}

function createPositionDragTarget(
  payload: DragPayload,
  id: string,
  side: PositionSide,
): DragTarget {
  return payload.type === 'group'
    ? { id, side, type: 'group-position' }
    : { id, side, type: 'goal-position' };
}

function getPositionTargetFromPoint(
  payload: DragPayload,
  clientX: number,
  clientY: number,
): DragTarget | null {
  const selector =
    payload.type === 'group' ? '[data-group-drop-id]' : '[data-goal-drop-id]';
  const cards = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element) => {
      const id =
        payload.type === 'group'
          ? element.dataset.groupDropId
          : element.dataset.goalDropId;

      return id
        ? {
            id,
            rect: element.getBoundingClientRect(),
          }
        : null;
    })
    .filter((card): card is { id: string; rect: DOMRect } =>
      Boolean(card && card.id !== payload.id),
    );

  if (cards.length === 0) {
    return null;
  }

  const rowCards = cards.filter(
    ({ rect }) => clientY >= rect.top - 14 && clientY <= rect.bottom + 14,
  );
  const candidates =
    rowCards.length > 0
      ? rowCards
      : cards.filter(({ rect }) => {
          const closestDistance = Math.min(
            ...cards.map((card) =>
              Math.abs(clientY - (card.rect.top + card.rect.height / 2)),
            ),
          );

          return (
            Math.abs(clientY - (rect.top + rect.height / 2)) === closestDistance
          );
        });
  const sortedCandidates = [...candidates].sort(
    (first, second) => first.rect.left - second.rect.left,
  );
  const firstCandidate = sortedCandidates[0];

  if (
    firstCandidate &&
    clientX < firstCandidate.rect.left + firstCandidate.rect.width / 2
  ) {
    return createPositionDragTarget(payload, firstCandidate.id, 'before');
  }

  const target =
    sortedCandidates
      .filter(({ rect }) => clientX >= rect.left + rect.width / 2)
      .at(-1) ?? sortedCandidates[0];

  if (!target) {
    return null;
  }

  return createPositionDragTarget(payload, target.id, 'after');
}

function getDragTargetFromPoint(
  payload: DragPayload,
  clientX: number,
  clientY: number,
): DragTarget | null {
  const target = document.elementFromPoint(
    clientX,
    clientY,
  ) as HTMLElement | null;
  const goalId =
    target?.closest<HTMLElement>('[data-goal-drop-id]')?.dataset.goalDropId ??
    null;
  const groupId =
    target?.closest<HTMLElement>('[data-group-drop-id]')?.dataset.groupDropId ??
    null;
  const ungroupedDropZone = target?.closest<HTMLElement>(
    '[data-ungrouped-drop-zone="true"]',
  );

  if (payload.type === 'group') {
    if (groupId && groupId !== payload.id) {
      const groupElement = target?.closest<HTMLElement>('[data-group-drop-id]');
      const rect = groupElement?.getBoundingClientRect();
      const side =
        rect && clientX < rect.left + rect.width / 2 ? 'before' : 'after';

      return { id: groupId, side, type: 'group-position' };
    }

    return getPositionTargetFromPoint(payload, clientX, clientY);
  }

  if (goalId && goalId !== payload.id) {
    return { id: goalId, type: 'goal-combine' };
  }

  if (groupId) {
    return { id: groupId, type: 'group-combine' };
  }

  const positionTarget = getPositionTargetFromPoint(payload, clientX, clientY);

  if (positionTarget) {
    return positionTarget;
  }

  if (ungroupedDropZone) {
    return { type: 'ungrouped' };
  }

  return null;
}

export function GoalsSurface() {
  const { dictionary, scope } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalIdSearchParam = searchParams.get('goal');
  const groupIdSearchParam = searchParams.get('group');
  const [selectedGoalIdOverride, setSelectedGoalIdOverride] = useState<
    string | null | undefined
  >(undefined);
  const [selectedGroupIdOverride, setSelectedGroupIdOverride] = useState<
    string | null | undefined
  >(undefined);
  const selectedGoalId = selectedGoalIdOverride ?? goalIdSearchParam;
  const selectedGroupId = selectedGoalId
    ? null
    : (selectedGroupIdOverride ?? groupIdSearchParam);
  const groups = useGoalGroups(scope);
  const activeGoals = useGoals(scope);
  const archivedGoals = useGoals(scope, { archived: true });
  const goalStepSummaries = useGoalStepSummaries(scope);
  const groupCategoryTags = useCategoryTags(scope, 'goal_group');
  const goalCategoryTags = useCategoryTags(scope, 'goal');
  const stepCategoryTags = useCategoryTags(scope, 'goal_step');
  const groupCategoryMap = useMemo(
    () => new Map(groupCategoryTags.map((tag) => [tag.id, tag])),
    [groupCategoryTags],
  );
  const goalCategoryMap = useMemo(
    () => new Map(goalCategoryTags.map((tag) => [tag.id, tag])),
    [goalCategoryTags],
  );
  const stepCategoryMap = useMemo(
    () => new Map(stepCategoryTags.map((tag) => [tag.id, tag])),
    [stepCategoryTags],
  );
  const [view, setView] = useState<'active' | 'archived'>('active');
  const selectedGoal = selectedGoalId
    ? ([...activeGoals, ...archivedGoals].find(
        (goal) => goal.id === selectedGoalId,
      ) ?? null)
    : null;
  const selectedGroup = selectedGroupId
    ? (groups.find((group) => group.id === selectedGroupId) ?? null)
    : null;
  const selectedGoalStepRows = useGoalStepTree(scope, selectedGoal?.id ?? null);
  const ungroupedActiveGoals = activeGoals.filter((goal) => !goal.groupId);
  const archivedGoalGroups = useMemo(() => {
    const knownGroupIds = new Set(groups.map((group) => group.id));
    const groupedGoals = groups
      .map((group) => ({
        group,
        goals: archivedGoals.filter((goal) => goal.groupId === group.id),
      }))
      .filter(({ goals }) => goals.length > 0);
    const ungroupedGoals = archivedGoals.filter(
      (goal) => !goal.groupId || !knownGroupIds.has(goal.groupId),
    );

    return ungroupedGoals.length > 0
      ? [
          ...groupedGoals,
          {
            group: null,
            goals: ungroupedGoals,
          },
        ]
      : groupedGoals;
  }, [archivedGoals, groups]);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const [activeDragPayload, setActiveDragPayload] =
    useState<DragPayload | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [pendingGoalCombine, setPendingGoalCombine] =
    useState<PendingGoalCombine | null>(null);
  const [pendingSingleGoalGroup, setPendingSingleGoalGroup] = useState<
    string | null
  >(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const clearDragState = useCallback(() => {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
    pointerDragRef.current = null;
    setActiveDragPayload(null);
    setDragTarget(null);
  }, []);

  const setCurrentDragTarget = useCallback((target: DragTarget | null) => {
    setDragTarget((current) =>
      target && isSameDragTarget(current, target) ? current : target,
    );
  }, []);

  const beginPointerDrag = useCallback(
    (payload: DragPayload, event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary) {
        return;
      }

      const card = event.currentTarget.closest<HTMLElement>(
        '[data-drag-card="true"]',
      );

      if (!card) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      dragPreviewRef.current?.remove();

      const rect = card.getBoundingClientRect();
      const preview = card.cloneNode(true) as HTMLElement;
      preview.setAttribute('aria-hidden', 'true');
      preview.style.position = 'fixed';
      preview.style.left = '0';
      preview.style.top = '0';
      preview.style.width = `${rect.width}px`;
      preview.style.height = `${rect.height}px`;
      preview.style.zIndex = '2147483647';
      preview.style.pointerEvents = 'none';
      preview.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      preview.style.transition = 'none';
      preview.style.boxShadow = '0 24px 56px rgba(5, 8, 13, 0.35)';
      document.body.appendChild(preview);

      pointerDragRef.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        payload,
        pointerId: event.pointerId,
      };
      dragPreviewRef.current = preview;
      setActiveDragPayload(payload);
      setCurrentDragTarget(null);
    },
    [setCurrentDragTarget],
  );

  useEffect(() => {
    const clearNavigationOverride = () => {
      setSelectedGoalIdOverride(undefined);
      setSelectedGroupIdOverride(undefined);
    };

    window.addEventListener('popstate', clearNavigationOverride);

    return () => {
      window.removeEventListener('popstate', clearNavigationOverride);
    };
  }, []);

  useEffect(() => {
    return () => {
      dragPreviewRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    function handlePointerCancel() {
      clearDragState();
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const dragState = pointerDragRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      dragPreviewRef.current?.style.setProperty(
        'transform',
        `translate3d(${event.clientX - dragState.offsetX}px, ${
          event.clientY - dragState.offsetY
        }px, 0)`,
      );

      const target = getDragTargetFromPoint(
        dragState.payload,
        event.clientX,
        event.clientY,
      );

      setCurrentDragTarget(target);
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      const dragState = pointerDragRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const target = getDragTargetFromPoint(
        dragState.payload,
        event.clientX,
        event.clientY,
      );
      const combineGoalId = target?.type === 'goal-combine' ? target.id : null;
      const positionGoalTarget =
        target?.type === 'goal-position' ? target : null;
      const combineGroupId =
        target?.type === 'group-combine' ? target.id : null;
      const positionGroupTarget =
        target?.type === 'group-position' ? target : null;
      const ungroupedDropZone = target?.type === 'ungrouped';
      const { payload } = dragState;
      clearDragState();

      if (!scope) {
        return;
      }

      if (payload.type === 'goal') {
        if (combineGoalId) {
          const targetGoal = activeGoals.find(
            (goal) => goal.id === combineGoalId,
          );

          if (targetGoal?.groupId) {
            void groupGoalsTogether({
              scope,
              sourceGoalId: payload.id,
              targetGoalId: combineGoalId,
              title: dictionary.goals.newGroupName,
            });
            return;
          }

          setPendingGoalCombine({
            sourceGoalId: payload.id,
            targetGoalId: combineGoalId,
          });
          return;
        }

        if (combineGroupId) {
          void moveGoalToGroup({
            scope,
            goalId: payload.id,
            groupId: combineGroupId,
          });
          return;
        }

        if (positionGoalTarget) {
          const moveGoal =
            positionGoalTarget.side === 'before'
              ? moveGoalBefore
              : moveGoalAfter;

          void moveGoal({
            scope,
            goalId: payload.id,
            targetGoalId: positionGoalTarget.id,
          });
          return;
        }

        if (ungroupedDropZone) {
          void moveGoalToGroup({ scope, goalId: payload.id, groupId: null });
        }
        return;
      }

      if (payload.type === 'group' && positionGroupTarget) {
        const moveGoalGroup =
          positionGroupTarget.side === 'before'
            ? moveGoalGroupBefore
            : moveGoalGroupAfter;

        void moveGoalGroup({
          scope,
          goalGroupId: payload.id,
          targetGoalGroupId: positionGroupTarget.id,
        });
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [
    activeGoals,
    clearDragState,
    dictionary.goals.newGroupName,
    scope,
    setCurrentDragTarget,
  ]);

  if (!scope) {
    return null;
  }
  const activeScope = scope;

  function openGoal(goalId: string) {
    setSelectedGoalIdOverride(goalId);
    setSelectedGroupIdOverride(null);
    router.push(`/goals?goal=${encodeURIComponent(goalId)}`);
  }

  function openGroup(groupId: string) {
    setSelectedGroupIdOverride(groupId);
    setSelectedGoalIdOverride(null);
    router.push(`/goals?group=${encodeURIComponent(groupId)}`);
  }

  function closeNestedView() {
    setSelectedGoalIdOverride(null);
    setSelectedGroupIdOverride(null);
    router.push('/goals');
  }

  async function archiveGoalAndOpenArchived(goalId: string) {
    await completeGoal({ scope: activeScope, goalId });
    setSelectedGoalIdOverride(null);
    setSelectedGroupIdOverride(null);
    setView('archived');
    router.push('/goals');
  }

  async function restoreGoalAndOpenActive(goalId: string) {
    await reopenGoal({ scope: activeScope, goalId });
    setSelectedGoalIdOverride(null);
    setSelectedGroupIdOverride(null);
    setView('active');
    router.push('/goals');
  }

  async function createGoalCard(groupId: string | null = null) {
    const goal = await createGoal({
      scope: activeScope,
      groupId,
      title: dictionary.goals.newGoalTitle,
    });
    openGoal(goal.id);
  }

  function closeCreateGroupDialog() {
    if (!isCreatingGroup) {
      setPendingGoalCombine(null);
      setPendingSingleGoalGroup(null);
    }
  }

  function confirmCreateGroup(title: string) {
    if (pendingSingleGoalGroup) {
      const goalId = pendingSingleGoalGroup;

      setIsCreatingGroup(true);
      void (async () => {
        const group = await createGoalGroup({ scope: activeScope, title });
        await moveGoalToGroup({
          scope: activeScope,
          goalId,
          groupId: group.id,
        });
      })().finally(() => {
        setIsCreatingGroup(false);
        setPendingSingleGoalGroup(null);
      });
      return;
    }

    if (!pendingGoalCombine) {
      return;
    }

    setIsCreatingGroup(true);
    void groupGoalsTogether({
      scope: activeScope,
      sourceGoalId: pendingGoalCombine.sourceGoalId,
      targetGoalId: pendingGoalCombine.targetGoalId,
      title,
    }).finally(() => {
      setIsCreatingGroup(false);
      setPendingGoalCombine(null);
    });
  }

  if (selectedGoal) {
    return (
      <section className="grid gap-5 pt-4 sm:pt-5 lg:pt-6">
        <GoalDetailHeader
          goal={selectedGoal}
          goalCategoryMap={goalCategoryMap}
          hasGoalSteps={selectedGoalStepRows.length > 0}
          isArchived={selectedGoal.completedAt !== null}
          onBack={closeNestedView}
          onDelete={closeNestedView}
          onArchive={archiveGoalAndOpenArchived}
          onRestore={restoreGoalAndOpenActive}
        />
        {selectedGoal.completedAt !== null ? (
          <ArchivedGoalDetailCard
            categoryTagMap={stepCategoryMap}
            goal={selectedGoal}
            goalStepRows={selectedGoalStepRows}
          />
        ) : (
          <GoalDetailCard
            categoryTags={stepCategoryTags}
            categoryTagMap={stepCategoryMap}
            goal={selectedGoal}
            goalStepRows={selectedGoalStepRows}
          />
        )}
      </section>
    );
  }

  if (selectedGroup) {
    const groupGoals = activeGoals.filter(
      (goal) => goal.groupId === selectedGroup.id,
    );

    return (
      <section className="grid gap-5 pt-4 sm:pt-5 lg:pt-6">
        <GoalGroupDetailHeader
          goalGroupCategoryMap={groupCategoryMap}
          group={selectedGroup}
          onBack={closeNestedView}
          onDelete={closeNestedView}
        />
        <GoalGrid
          activeDragPayload={activeDragPayload}
          archived={false}
          dragTarget={dragTarget}
          goals={groupGoals}
          groups={groups}
          goalCategoryMap={goalCategoryMap}
          stepCategoryMap={stepCategoryMap}
          summaries={goalStepSummaries}
          onBeginPointerDrag={beginPointerDrag}
          onComplete={archiveGoalAndOpenArchived}
          onMoveGoal={(goalId, groupId) =>
            moveGoalToGroup({ scope, goalId, groupId })
          }
          onOpenGoal={openGoal}
        >
          <NewEntityCard
            label={dictionary.goals.newGoalTitle}
            onClick={() => void createGoalCard(selectedGroup.id)}
          />
        </GoalGrid>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 pt-4 sm:pt-5 lg:pt-6">
        {view === 'archived' ? (
          archivedGoalGroups.length > 0 ? (
            <div className="grid gap-5">
              {archivedGoalGroups.map(({ group, goals: groupedGoals }) => {
                const groupCategory = group
                  ? groupCategoryMap.get(group.categoryTagId ?? '')
                  : null;

                return (
                  <section
                    key={group?.id ?? 'none'}
                    className="grid gap-2.5"
                    data-testid={`archived-goal-group-${group?.id ?? 'none'}`}
                  >
                    <div className="flex min-w-0 items-center gap-2 px-1">
                      {groupCategory &&
                      groupCategory.name.trim().length === 0 ? (
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: groupCategory.colorHex }}
                        />
                      ) : null}
                      <h2 className="truncate text-sm font-semibold text-[#cbd5e0]">
                        {group?.title || dictionary.goals.noGroup}
                      </h2>
                      {groupCategory && groupCategory.name.trim().length > 0 ? (
                        <span
                          className="max-w-[40%] shrink-0 truncate rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#f7e8ce]"
                          style={
                            {
                              '--chip-edge': toAlphaColor(
                                groupCategory.colorHex,
                                0.6,
                              ),
                              backgroundColor: toAlphaColor(
                                groupCategory.colorHex,
                                0.14,
                              ),
                            } as CSSProperties
                          }
                        >
                          {groupCategory.name}
                        </span>
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="h-px min-w-8 flex-1 bg-white/10"
                      />
                    </div>
                    <GoalGrid
                      activeDragPayload={activeDragPayload}
                      archived
                      dragTarget={dragTarget}
                      goals={groupedGoals}
                      groups={groups}
                      goalCategoryMap={goalCategoryMap}
                      layout="overview"
                      stepCategoryMap={stepCategoryMap}
                      summaries={goalStepSummaries}
                      onBeginPointerDrag={beginPointerDrag}
                      onOpenGoal={openGoal}
                      onRestore={restoreGoalAndOpenActive}
                    />
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-[#909cab]">
              {dictionary.goals.emptyArchivedGoals}
            </p>
          )
        ) : (
          <>
            <div
              className={`grid gap-3 rounded-[1.35rem] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                dragTarget?.type === 'ungrouped' &&
                activeDragPayload?.type === 'goal'
                  ? 'inset-ring-hairline inset-ring-[#f0c38e]/45'
                  : ''
              }`}
              data-ungrouped-drop-zone="true"
            >
              {groups.map((group) => {
                const groupGoals = activeGoals.filter(
                  (goal) => goal.groupId === group.id,
                );

                return (
                  <GoalGroupCard
                    key={group.id}
                    activeDragPayload={activeDragPayload}
                    category={groupCategoryMap.get(group.categoryTagId ?? '')}
                    dragTarget={dragTarget}
                    goals={groupGoals}
                    group={group}
                    goalCategoryMap={goalCategoryMap}
                    summaries={goalStepSummaries}
                    onBeginPointerDrag={beginPointerDrag}
                    onOpen={openGroup}
                  />
                );
              })}

              {ungroupedActiveGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  activeDragPayload={activeDragPayload}
                  archived={false}
                  dragTarget={dragTarget}
                  goal={goal}
                  goalCategory={goalCategoryMap.get(goal.categoryTagId ?? '')}
                  groups={groups}
                  stepCategoryMap={stepCategoryMap}
                  summary={getGoalStepSummary(goalStepSummaries, goal.id)}
                  onBeginPointerDrag={beginPointerDrag}
                  onComplete={archiveGoalAndOpenArchived}
                  onCreateGroup={(goalId) => setPendingSingleGoalGroup(goalId)}
                  onMoveGoal={(goalId, groupId) =>
                    moveGoalToGroup({ scope, goalId, groupId })
                  }
                  onOpen={openGoal}
                />
              ))}

              <NewEntityCard
                label={dictionary.goals.newGoalTitle}
                onClick={() => void createGoalCard(null)}
              />
            </div>

            <div className="grid gap-3">
              <div aria-hidden="true" className="h-px w-full bg-white/10" />
              <Button
                className="min-h-10 w-fit rounded-full inset-ring-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f8f3ea] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-[#f7d9b0]"
                tone="subtle"
                onClick={() => setView('archived')}
              >
                <Archive aria-hidden="true" className="size-4 text-[#f0c38e]" />
                {dictionary.goals.archivedGoals}
              </Button>
            </div>
          </>
        )}

        {view === 'archived' ? (
          <div className="grid gap-3">
            <div aria-hidden="true" className="h-px w-full bg-white/10" />
            <Button
              className="min-h-10 w-fit rounded-full inset-ring-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f8f3ea] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-[#f7d9b0]"
              tone="subtle"
              onClick={() => setView('active')}
            >
              <Target aria-hidden="true" className="size-4 text-[#f0c38e]" />
              {dictionary.goals.activeGoals}
            </Button>
          </div>
        ) : null}
      </section>

      {pendingGoalCombine || pendingSingleGoalGroup ? (
        <CreateGoalGroupDialog
          cancelLabel={dictionary.actions.cancel}
          confirmLabel={dictionary.goals.createGroupConfirm}
          groupTitleLabel={dictionary.goals.groupTitlePlaceholder}
          initialTitle={dictionary.goals.newGroupName}
          isCreatingGroup={isCreatingGroup}
          title={dictionary.goals.createGroupTitle}
          onClose={closeCreateGroupDialog}
          onConfirm={confirmCreateGroup}
        />
      ) : null}
    </>
  );
}

function CreateGoalGroupDialog({
  cancelLabel,
  confirmLabel,
  groupTitleLabel,
  initialTitle,
  isCreatingGroup,
  title,
  onClose,
  onConfirm,
}: {
  cancelLabel: string;
  confirmLabel: string;
  groupTitleLabel: string;
  initialTitle: string;
  isCreatingGroup: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (title: string) => void;
}) {
  const [groupTitle, setGroupTitle] = useState(initialTitle.toUpperCase());

  const closeDialog = useCallback(() => {
    if (!isCreatingGroup) {
      onClose();
    }
  }, [isCreatingGroup, onClose]);

  const normalizedTitle = groupTitle.trim();

  return (
    <Dialog
      closeLabel={cancelLabel}
      open
      panelClassName="sm:h-auto sm:max-w-md"
      title={title}
      onClose={closeDialog}
    >
      <form
        className="flex flex-col gap-5 p-4 sm:p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();

          if (normalizedTitle.length > 0) {
            onConfirm(normalizedTitle);
          }
        }}
      >
        <label
          className={`grid gap-2 text-sm font-medium text-[#fff9f2] ${
            isCreatingGroup ? 'opacity-75' : ''
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#909cab]">
            {groupTitleLabel}
          </span>
          <Input
            aria-label={groupTitleLabel}
            className="h-10 w-full rounded-xl inset-ring-hairline inset-ring-white/10 bg-white/[0.04] px-3 text-base font-medium text-[#fff9f2] outline-none placeholder:text-[#7b8da0] focus:inset-ring-[#f0c38e]/40 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-muted/60"
            disabled={isCreatingGroup}
            placeholder={initialTitle}
            value={groupTitle}
            onChange={(event) =>
              setGroupTitle(event.target.value.toUpperCase())
            }
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <ModalActionButton onClick={closeDialog}>
            <X aria-hidden="true" className="size-3.5" />
            {cancelLabel}
          </ModalActionButton>
          <ModalActionButton
            type="submit"
            tone="accent"
            disabled={normalizedTitle.length === 0 || isCreatingGroup}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {confirmLabel}
          </ModalActionButton>
        </div>
      </form>
    </Dialog>
  );
}

function NewEntityCard({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative flex h-32 flex-col items-center justify-center gap-3 rounded-[1.35rem] bg-transparent p-4 text-center text-[#cbd5e0] transition [--dashed-ring-color:rgba(144,156,171,0.3)] hover:-translate-y-0.5 hover:bg-white/[0.02] hover:[--dashed-ring-color:rgba(240,195,142,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
      onClick={onClick}
    >
      <DashedRing radius={21.6} />
      <div className="flex size-11 items-center justify-center rounded-full bg-[#f0c38e]/10 text-[#f0c38e] transition transform group-hover:bg-[#f0c38e]/20 group-hover:scale-105">
        <Plus aria-hidden="true" className="size-5" />
      </div>
      <span className="text-sm font-semibold text-[#f8dfbd] transition group-hover:text-[#f0c38e]">
        {label}
      </span>
    </button>
  );
}

function DropTargetOverlay() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-[#f0c38e]/10 shadow-[0_18px_34px_rgba(5,8,13,0.12)] [--dashed-ring-color:rgba(240,195,142,0.8)]"
    >
      <DashedRing radius={21.6} />
    </span>
  );
}

function PositionIndicator({ side }: { side: PositionSide }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-4 z-20 h-[calc(100%-2rem)] w-1 rounded-full bg-[#f0c38e] shadow-[0_0_0_3px_rgba(240,195,142,0.16),0_0_18px_rgba(240,195,142,0.42)] ${
        side === 'before' ? '-left-2' : '-right-2'
      }`}
    />
  );
}

function CategoryAccent({
  category,
  position = 'dot',
  size = 'lg',
}: {
  category?: CategoryTag | null;
  position?: 'dot' | 'top' | 'vertical';
  size?: 'sm' | 'lg';
}) {
  if (!category) {
    return null;
  }

  if (position === 'vertical') {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow: `inset 4px 0 0 0 ${category.colorHex}`,
        }}
      />
    );
  }

  if (position === 'top') {
    return (
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: category.colorHex }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 p-1 shadow-sm shadow-[#253241]/10 ${size === 'sm' ? 'size-6' : 'size-8'}`}
    >
      <span
        className="block size-full rounded-full inset-ring-hairline inset-ring-white/30 shadow-[0_6px_14px_rgba(5,8,13,0.24)]"
        style={{ backgroundColor: category.colorHex }}
      />
    </span>
  );
}

async function applyOwnColorCategory({
  colorHex,
  onAssign,
  scope,
  selectedCategory,
  surface,
}: {
  colorHex: string;
  onAssign: (categoryTagId: string) => Promise<void> | void;
  scope: AppScope;
  selectedCategory: CategoryTag | null;
  surface: CategoryTagSurface;
}) {
  if (selectedCategory?.useOwnName) {
    await updateCategoryTag({
      scope,
      categoryTagId: selectedCategory.id,
      colorHex,
    });
    return;
  }

  const createdTag = await createCategoryTag({
    scope,
    surface,
    name: '',
    colorHex,
    useOwnName: true,
  });

  await onAssign(createdTag.id);
}

function CategoryColorButton({
  onAssign,
  scope,
  selectedCategory,
  surface,
}: {
  onAssign: (categoryTagId: string) => Promise<void> | void;
  scope: AppScope | null;
  selectedCategory: CategoryTag | null;
  surface: CategoryTagSurface;
}) {
  const { dictionary } = useAppContext();

  if (!canUseOwnName(surface)) {
    return null;
  }

  const ownColorHex = selectedCategory?.useOwnName
    ? selectedCategory.colorHex
    : null;
  const colorLabel =
    surface === 'goal_group'
      ? dictionary.goals.assignGroupColor
      : dictionary.goals.assignGoalColor;

  async function handleColorChange(colorHex: string) {
    if (!scope) {
      return;
    }

    await applyOwnColorCategory({
      colorHex,
      onAssign,
      scope,
      selectedCategory,
      surface,
    });
  }

  return (
    <Tooltip content={colorLabel}>
      <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f7d9b0]">
        <input
          aria-label={colorLabel}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="color"
          value={ownColorHex ?? '#71717a'}
          onChange={(event) => void handleColorChange(event.target.value)}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none relative block size-5 rounded-full shadow-[0_6px_14px_rgba(5,8,13,0.24)] ${
            ownColorHex
              ? 'inset-ring-hairline inset-ring-white/30'
              : '[--dashed-ring-color:rgba(255,255,255,0.25)]'
          }`}
          style={ownColorHex ? { backgroundColor: ownColorHex } : undefined}
        >
          {ownColorHex ? null : <DashedRing radius={10} />}
        </span>
      </span>
    </Tooltip>
  );
}

function GoalGroupCard({
  activeDragPayload,
  category,
  dragTarget,
  goals,
  group,
  goalCategoryMap,
  summaries,
  onBeginPointerDrag,
  onOpen,
}: {
  activeDragPayload: DragPayload | null;
  category?: CategoryTag | null;
  dragTarget: DragTarget | null;
  goals: Goal[];
  group: GoalGroup;
  goalCategoryMap: Map<string, CategoryTag>;
  summaries: Map<string, GoalStepSummary>;
  onBeginPointerDrag: (
    payload: DragPayload,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onOpen: (groupId: string) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [categoryJoinShape, setCategoryJoinShape] =
    useState<DropdownJoinShape | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const groupPayload = { id: group.id, type: 'group' } satisfies DragPayload;
  const groupCardLabel = [
    group.title || dictionary.goals.newGroupName,
    ...goals.map((goal) => goal.title || dictionary.goals.newGoalTitle),
  ].join('');
  const isDragging = isSameDragPayload(activeDragPayload, groupPayload);
  const showDropTarget =
    activeDragPayload?.type === 'goal' &&
    dragTarget?.type === 'group-combine' &&
    dragTarget.id === group.id &&
    !isDragging;
  const positionTarget =
    activeDragPayload?.type === 'group' &&
    dragTarget?.type === 'group-position' &&
    dragTarget.id === group.id &&
    !isDragging
      ? dragTarget
      : null;
  const taskCount = goals.reduce(
    (count, goal) => count + getGoalStepSummary(summaries, goal.id).itemCount,
    0,
  );
  const completedTaskCount = goals.reduce(
    (count, goal) =>
      count + getGoalStepSummary(summaries, goal.id).completedCount,
    0,
  );
  const taskStatus =
    taskCount === 0
      ? 'empty'
      : completedTaskCount === taskCount
        ? 'complete'
        : 'pending';

  const getMenuStyle = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === 'undefined') {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();

    return {
      right: Math.max(16, window.innerWidth - triggerRect.right),
      top: Math.max(16, triggerRect.bottom + 8),
    };
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setMenuStyle(null);
    setCategoryJoinShape(null);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    const colorInput = colorInputRef.current;

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    colorInput?.addEventListener('change', closeMenu);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
      colorInput?.removeEventListener('change', closeMenu);
    };
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function updateMenuStyle() {
      const nextMenuStyle = getMenuStyle();

      if (nextMenuStyle) {
        setMenuStyle(nextMenuStyle);
      }
    }

    window.addEventListener('resize', updateMenuStyle);
    window.addEventListener('scroll', updateMenuStyle, true);

    return () => {
      window.removeEventListener('resize', updateMenuStyle);
      window.removeEventListener('scroll', updateMenuStyle, true);
    };
  }, [getMenuStyle, isMenuOpen]);

  const menu =
    isMenuOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            data-card-actions-menu="true"
            className={`modal-panel modal-panel--flat fixed z-60 grid max-h-[min(20rem,calc(100vh-2rem))] min-w-52 gap-1 overflow-y-auto p-2 text-sm shadow-[0_24px_70px_rgba(5,8,13,0.44)] ${
              categoryJoinShape ? 'dropdown-joined-main' : ''
            } ${
              categoryJoinShape && categoryJoinShape !== 'main-taller'
                ? 'rounded-r-none'
                : ''
            }`}
            style={menuStyle}
            onClick={(event) => event.stopPropagation()}
          >
            {canUseOwnName('goal_group') ? (
              <label className="relative flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-left font-medium text-[#fff9f2] transition focus-within:bg-white/[0.08] hover:bg-white/[0.08]">
                {category?.useOwnName ? (
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full inset-ring-hairline inset-ring-white/30"
                    style={{ backgroundColor: category.colorHex }}
                  />
                ) : (
                  <Palette aria-hidden="true" className="size-4" />
                )}
                {dictionary.goals.assignGroupColor}
                <input
                  ref={colorInputRef}
                  aria-label={dictionary.goals.assignGroupColor}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  type="color"
                  value={category?.useOwnName ? category.colorHex : '#71717a'}
                  onInput={(event) => {
                    if (!scope) return;
                    void applyOwnColorCategory({
                      colorHex: event.currentTarget.value,
                      onAssign: (categoryTagId) =>
                        assignGoalGroupCategory({
                          scope,
                          goalGroupId: group.id,
                          categoryTagId,
                        }),
                      scope,
                      selectedCategory: category ?? null,
                      surface: 'goal_group',
                    });
                  }}
                />
              </label>
            ) : null}
            <CategoryMenuSection
              label={dictionary.goals.assignGroupCategoryMenu}
              surface="goal_group"
              onJoinShapeChange={setCategoryJoinShape}
              onAssign={(categoryTagId) => {
                closeMenu();
                if (!scope) return;
                return assignGoalGroupCategory({
                  scope,
                  goalGroupId: group.id,
                  categoryTagId,
                });
              }}
            />
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-left font-medium text-[#fff9f2] transition hover:bg-white/[0.08]"
              onClick={() => {
                closeMenu();
                if (!scope) return;
                void assignGoalGroupCategory({
                  scope,
                  goalGroupId: group.id,
                  categoryTagId: null,
                });
              }}
            >
              <TaskTreeClearCategoryIcon className="size-4" />
              {dictionary.goals.clearGroupCategory}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-left font-medium text-rose-300 hover:bg-rose-400/15 hover:text-rose-200"
              onClick={() => {
                closeMenu();
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {dictionary.goals.deleteGroup}
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        aria-label={groupCardLabel}
        className={`group relative grid h-32 cursor-pointer content-start gap-2 rounded-[1.35rem] bg-white/[0.05] px-4 pb-5 pt-3.5 text-left shadow-[0_14px_34px_rgba(5,8,13,0.12)] inset-ring-hairline inset-ring-transparent transition hover:-translate-y-0.5 hover:bg-white/[0.075] hover:inset-ring-[#f0c38e]/25 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
          isDragging ? 'invisible' : ''
        }`}
        data-drag-card="true"
        data-group-drop-id={group.id}
        onClick={() => onOpen(group.id)}
        onKeyDown={(event) => {
          if (event.currentTarget !== event.target) {
            return;
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(group.id);
          }
        }}
      >
        {showDropTarget ? <DropTargetOverlay /> : null}
        {positionTarget ? (
          <PositionIndicator side={positionTarget.side} />
        ) : null}
        <span className="flex min-w-0 items-center justify-start gap-2">
          <Tooltip content={dictionary.goals.dragGoal}>
            <button
              type="button"
              aria-label={dictionary.goals.dragGoal}
              className="inline-flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-full inset-ring-hairline inset-ring-white/10 bg-white/[0.045] text-[#aebac8] transition hover:-translate-y-0.5 hover:inset-ring-[#f0c38e]/50 hover:bg-[#f0c38e]/14 hover:text-[#fff9f2] hover:shadow-[0_10px_22px_rgba(240,195,142,0.16)] active:translate-y-0 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => onBeginPointerDrag(groupPayload, event)}
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <Tooltip
              className="min-w-0 flex-1"
              content={group.title || dictionary.goals.newGroupName}
            >
              {category?.useOwnName ? (
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-3 py-1 shadow-sm shadow-[#253241]/10"
                  style={
                    {
                      '--chip-edge': toAlphaColor(category.colorHex, 0.6),
                      backgroundColor: toAlphaColor(category.colorHex, 0.14),
                    } as CSSProperties
                  }
                >
                  <span className="truncate text-base font-semibold leading-tight text-[#fff9f2]">
                    {group.title || dictionary.goals.newGroupName}
                  </span>
                </span>
              ) : (
                <span className="min-w-0 truncate text-base font-semibold leading-tight text-[#fff9f2]">
                  {group.title || dictionary.goals.newGroupName}
                </span>
              )}
            </Tooltip>
            {category && !category.useOwnName ? (
              <Tooltip className="max-w-[45%] shrink" content={category.name}>
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center gap-2 rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#f7e8ce] shadow-sm shadow-[#253241]/10"
                  style={
                    {
                      '--chip-edge': toAlphaColor(category.colorHex, 0.6),
                      backgroundColor: toAlphaColor(category.colorHex, 0.14),
                    } as CSSProperties
                  }
                >
                  <span className="truncate">{category.name}</span>
                </span>
              </Tooltip>
            ) : null}
          </span>
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${
              taskStatus === 'pending'
                ? 'bg-[#f0c38e]'
                : taskStatus === 'complete'
                  ? 'bg-emerald-400'
                  : 'bg-[#66717f]'
            }`}
            data-status={taskStatus}
            data-testid={`goal-group-task-indicator-${group.id}`}
          />
          <IconButton
            ref={triggerRef}
            aria-expanded={isMenuOpen}
            aria-label={dictionary.goals.groupMenu}
            className="size-8 rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={(event) => {
              event.stopPropagation();

              if (isMenuOpen) {
                closeMenu();
                return;
              }

              const nextMenuStyle = getMenuStyle();

              if (nextMenuStyle) {
                setMenuStyle(nextMenuStyle);
                setIsMenuOpen(true);
              }
            }}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </IconButton>
        </span>
        <span className="grid grid-cols-2 gap-2 self-start">
          {goals.slice(0, goals.length > 4 ? 3 : 4).map((goal) => {
            const cat = goalCategoryMap.get(goal.categoryTagId ?? '');
            return (
              <span
                key={goal.id}
                className="relative flex min-h-0 flex-col justify-center overflow-hidden truncate rounded-[0.95rem] bg-white/[0.05] py-1.5 text-left"
              >
                <CategoryAccent category={cat} position="vertical" />
                <span
                  className={`flex flex-col justify-center truncate leading-tight ${cat ? 'pl-5 pr-3' : 'px-4'}`}
                >
                  <span className="truncate text-xs font-semibold text-[#f8f3ea]">
                    {goal.title || dictionary.goals.newGoalTitle}
                  </span>
                </span>
              </span>
            );
          })}
          {goals.length > 4 ? (
            <span className="flex items-center justify-center truncate rounded-[0.95rem] bg-white/[0.05] px-3 py-1.5 text-center text-xs font-medium text-[#f8f3ea]">
              +{goals.length - 3}
            </span>
          ) : null}
        </span>
      </article>
      {menu}
      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.goals.confirmDeleteGroup}
        open={isDeleteDialogOpen}
        title={dictionary.goals.deleteGroup}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => {
          setIsDeleteDialogOpen(false);
          if (!scope) return;
          void softDeleteGoalGroup({ scope, goalGroupId: group.id });
        }}
      />
    </>
  );
}

function GoalGrid({
  children,
  activeDragPayload,
  archived,
  dragTarget,
  goals,
  groups,
  goalCategoryMap,
  layout = 'default',
  stepCategoryMap,
  summaries,
  onBeginPointerDrag,
  onComplete,
  onMoveGoal,
  onOpenGoal,
  onRestore,
}: {
  activeDragPayload: DragPayload | null;
  archived: boolean;
  dragTarget: DragTarget | null;
  goals: Goal[];
  groups: GoalGroup[];
  goalCategoryMap: Map<string, CategoryTag>;
  layout?: 'default' | 'overview';
  stepCategoryMap: Map<string, CategoryTag>;
  summaries: Map<string, GoalStepSummary>;
  onComplete?: (goalId: string) => Promise<void> | void;
  onBeginPointerDrag?: (
    payload: DragPayload,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onMoveGoal?: (goalId: string, groupId: string | null) => Promise<void> | void;
  onOpenGoal: (goalId: string) => void;
  onRestore?: (goalId: string) => Promise<void> | void;
  children?: ReactNode;
}) {
  if (goals.length === 0 && !children) {
    return null;
  }

  return (
    <div
      className={`grid gap-3 md:grid-cols-2 ${
        layout === 'overview'
          ? 'lg:grid-cols-3 xl:grid-cols-4'
          : 'xl:grid-cols-3'
      }`}
    >
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          activeDragPayload={activeDragPayload}
          archived={archived}
          dragTarget={dragTarget}
          goal={goal}
          goalCategory={goalCategoryMap.get(goal.categoryTagId ?? '')}
          groups={groups}
          stepCategoryMap={stepCategoryMap}
          summary={getGoalStepSummary(summaries, goal.id)}
          onBeginPointerDrag={onBeginPointerDrag}
          onComplete={onComplete}
          onMoveGoal={onMoveGoal}
          onOpen={onOpenGoal}
          onRestore={onRestore}
        />
      ))}
      {children}
    </div>
  );
}

function GoalCard({
  activeDragPayload,
  archived,
  dragTarget,
  goal,
  goalCategory,
  groups,
  stepCategoryMap,
  summary,
  onBeginPointerDrag,
  onComplete,
  onCreateGroup,
  onMoveGoal,
  onOpen,
  onRestore,
}: {
  activeDragPayload: DragPayload | null;
  archived: boolean;
  dragTarget: DragTarget | null;
  goal: Goal;
  goalCategory?: CategoryTag | null;
  groups: GoalGroup[];
  stepCategoryMap: Map<string, CategoryTag>;
  summary: GoalStepSummary;
  onComplete?: (goalId: string) => Promise<void> | void;
  onBeginPointerDrag?: (
    payload: DragPayload,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onCreateGroup?: (goalId: string) => void;
  onMoveGoal?: (goalId: string, groupId: string | null) => Promise<void> | void;
  onOpen: (goalId: string) => void;
  onRestore?: (goalId: string) => Promise<void> | void;
}) {
  const { dictionary, scope } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [categoryJoinShape, setCategoryJoinShape] =
    useState<DropdownJoinShape | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    bottom?: number;
    left: number;
    top?: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const progressTone = getProgressTone(summary);
  const goalPayload = { id: goal.id, type: 'goal' } satisfies DragPayload;
  const isDragging = isSameDragPayload(activeDragPayload, goalPayload);
  const showDropTarget =
    activeDragPayload?.type === 'goal' &&
    dragTarget?.type === 'goal-combine' &&
    dragTarget.id === goal.id &&
    !isDragging;
  const positionTarget =
    activeDragPayload?.type === 'goal' &&
    dragTarget?.type === 'goal-position' &&
    dragTarget.id === goal.id &&
    !isDragging
      ? dragTarget
      : null;
  const getMenuStyle = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === 'undefined') {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const menuOffset = 8;
    const menuWidth = Math.min(
      224,
      Math.max(0, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuWidth),
      window.innerWidth - viewportPadding - menuWidth,
    );
    const estimatedMenuHeight =
      menuRef.current?.offsetHeight ?? (archived ? 104 : 320);
    const shouldOpenUpward =
      triggerRect.bottom + menuOffset + estimatedMenuHeight >
        window.innerHeight - viewportPadding &&
      triggerRect.top > window.innerHeight - triggerRect.bottom;

    if (shouldOpenUpward) {
      return {
        bottom: Math.max(
          viewportPadding,
          window.innerHeight - triggerRect.top + menuOffset,
        ),
        left,
        width: menuWidth,
      };
    }

    return {
      left,
      top: Math.max(viewportPadding, triggerRect.bottom + menuOffset),
      width: menuWidth,
    };
  }, [archived]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setMenuStyle(null);
    setCategoryJoinShape(null);
  }, []);

  const deleteGoal = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsDeleteDialogOpen(false);
    await softDeleteGoal({ scope, goalId: goal.id });
  }, [goal.id, scope]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    const colorInput = colorInputRef.current;

    function handleColorPickerClose() {
      closeMenu();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    colorInput?.addEventListener('change', handleColorPickerClose);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
      colorInput?.removeEventListener('change', handleColorPickerClose);
    };
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function updateMenuStyle() {
      const nextMenuStyle = getMenuStyle();

      if (nextMenuStyle) {
        setMenuStyle(nextMenuStyle);
      }
    }

    window.addEventListener('resize', updateMenuStyle);
    window.addEventListener('scroll', updateMenuStyle, true);

    return () => {
      window.removeEventListener('resize', updateMenuStyle);
      window.removeEventListener('scroll', updateMenuStyle, true);
    };
  }, [getMenuStyle, isMenuOpen]);

  const menu =
    isMenuOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            data-card-actions-menu="true"
            data-goal-actions-menu="true"
            className={`modal-panel modal-panel--flat fixed z-60 grid max-h-[min(20rem,calc(100vh-2rem))] gap-1 overflow-y-auto p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(5,8,13,0.44)] ${
              categoryJoinShape ? 'dropdown-joined-main' : ''
            } ${
              categoryJoinShape && categoryJoinShape !== 'main-taller'
                ? 'rounded-r-none'
                : ''
            }`}
            style={menuStyle}
            onClick={(event) => event.stopPropagation()}
          >
            {!archived && onCreateGroup && goal.groupId === null ? (
              <button
                type="button"
                className={goalMenuItemClassName}
                onClick={() => {
                  closeMenu();
                  onCreateGroup(goal.id);
                }}
              >
                <FolderPlus aria-hidden="true" className="size-4" />
                {dictionary.goals.createGroup}
              </button>
            ) : null}
            {!archived && canUseOwnName('goal') ? (
              <label
                className={`relative cursor-pointer ${goalMenuItemClassName}`}
              >
                {goalCategory?.useOwnName ? (
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full inset-ring-hairline inset-ring-white/30"
                    style={{ backgroundColor: goalCategory.colorHex }}
                  />
                ) : (
                  <Palette aria-hidden="true" className="size-4" />
                )}
                {dictionary.goals.assignGoalColor}
                <input
                  ref={colorInputRef}
                  aria-label={dictionary.goals.assignGoalColor}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  type="color"
                  value={
                    goalCategory?.useOwnName ? goalCategory.colorHex : '#71717a'
                  }
                  onInput={(event) => {
                    if (!scope) return;
                    void applyOwnColorCategory({
                      colorHex: event.currentTarget.value,
                      onAssign: (categoryTagId) =>
                        assignGoalCategory({
                          scope,
                          goalId: goal.id,
                          categoryTagId,
                        }),
                      scope,
                      selectedCategory: goalCategory ?? null,
                      surface: 'goal',
                    });
                  }}
                />
              </label>
            ) : null}
            {!archived ? (
              <CategoryMenuSection
                label={dictionary.goals.assignGoalCategoryMenu}
                surface="goal"
                onJoinShapeChange={setCategoryJoinShape}
                onAssign={(categoryTagId) => {
                  closeMenu();
                  if (!scope) return;
                  return assignGoalCategory({
                    scope,
                    goalId: goal.id,
                    categoryTagId,
                  });
                }}
              />
            ) : null}
            {!archived && goal.categoryTagId !== null ? (
              <button
                type="button"
                className={goalMenuItemClassName}
                onClick={() => {
                  closeMenu();
                  if (!scope) return;
                  void assignGoalCategory({
                    scope,
                    goalId: goal.id,
                    categoryTagId: null,
                  });
                }}
              >
                <TaskTreeClearCategoryIcon className="size-4" />
                {dictionary.goals.clearGoalCategory}
              </button>
            ) : null}
            {!archived && onComplete ? (
              <button
                type="button"
                className={goalMenuItemClassName}
                onClick={() => {
                  closeMenu();
                  setIsArchiveDialogOpen(true);
                }}
              >
                <Archive aria-hidden="true" className="size-4" />
                {dictionary.goals.completeGoal}
              </button>
            ) : null}
            {archived && onRestore ? (
              <button
                type="button"
                className={goalMenuItemClassName}
                onClick={() => {
                  closeMenu();
                  setIsRestoreDialogOpen(true);
                }}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                {dictionary.goals.restoreGoal}
              </button>
            ) : null}
            <button
              type="button"
              className={goalMenuDangerItemClassName}
              onClick={() => {
                closeMenu();
                if (summary.itemCount > 0) {
                  setIsDeleteDialogOpen(true);
                } else {
                  void deleteGoal();
                }
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {dictionary.goals.deleteGoal}
            </button>
            {!archived && onMoveGoal && goal.groupId !== null ? (
              <button
                type="button"
                className={goalMenuItemClassName}
                onClick={() => {
                  closeMenu();
                  void onMoveGoal(goal.id, null);
                }}
              >
                <LogOut aria-hidden="true" className="size-4" />
                <span className="text-sm font-medium leading-tight">
                  {dictionary.goals.removeFromGroup}
                </span>
              </button>
            ) : null}
            {!archived && onMoveGoal ? (
              <MoveGoalMenu
                currentGroupId={goal.groupId}
                groups={groups}
                onMove={(groupId) => {
                  closeMenu();
                  return onMoveGoal(goal.id, groupId);
                }}
              />
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <article
        aria-label={goal.title || dictionary.goals.newGoalTitle}
        className={`group relative grid h-32 cursor-pointer content-start gap-3 rounded-[1.35rem] bg-white/[0.055] p-4 text-left shadow-[0_14px_34px_rgba(5,8,13,0.12)] inset-ring-hairline inset-ring-transparent transition hover:-translate-y-0.5 hover:bg-white/[0.08] hover:inset-ring-[#f0c38e]/25 ${
          archived ? 'opacity-95' : ''
        } ${isDragging ? 'invisible' : ''}`}
        data-drag-card="true"
        data-goal-drop-id={archived ? undefined : goal.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (isMenuOpen) {
            closeMenu();
            return;
          }

          onOpen(goal.id);
        }}
        onKeyDown={(event) => {
          if (
            event.currentTarget === event.target &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault();

            if (isMenuOpen) {
              closeMenu();
              return;
            }

            onOpen(goal.id);
          }
        }}
      >
        {showDropTarget ? <DropTargetOverlay /> : null}
        {positionTarget ? (
          <PositionIndicator side={positionTarget.side} />
        ) : null}
        <CategoryAccent category={goalCategory} position="vertical" />
        <div className="flex min-w-0 items-center justify-start gap-2">
          {!archived ? (
            <Tooltip content={dictionary.goals.dragGoal}>
              <button
                type="button"
                aria-label={dictionary.goals.dragGoal}
                className="inline-flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-full inset-ring-hairline inset-ring-white/10 bg-white/[0.045] text-[#aebac8] transition hover:-translate-y-0.5 hover:inset-ring-[#f0c38e]/50 hover:bg-[#f0c38e]/14 hover:text-[#fff9f2] hover:shadow-[0_10px_22px_rgba(240,195,142,0.16)] active:translate-y-0 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) =>
                  onBeginPointerDrag?.(goalPayload, event)
                }
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
          ) : null}
          <Tooltip
            className="min-w-0 flex-1"
            content={goal.title || dictionary.goals.newGoalTitle}
          >
            <span className="min-w-0 truncate text-base font-semibold leading-tight text-[#fff9f2]">
              {goal.title || dictionary.goals.newGoalTitle}
            </span>
          </Tooltip>
          {goalCategory &&
          !goalCategory.useOwnName &&
          goalCategory.name.trim().length > 0 ? (
            <Tooltip className="max-w-[40%] shrink" content={goalCategory.name}>
              <span
                className="min-w-0 truncate text-xs font-semibold leading-tight"
                style={{ color: goalCategory.colorHex }}
              >
                {goalCategory.name}
              </span>
            </Tooltip>
          ) : null}
          <IconButton
            ref={triggerRef}
            aria-expanded={isMenuOpen}
            aria-label={dictionary.goals.goalMenu}
            className="size-8 rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={(event) => {
              event.stopPropagation();
              if (isMenuOpen) {
                closeMenu();
                return;
              }

              setMenuStyle(getMenuStyle());
              setIsMenuOpen(true);
            }}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        {menu}
        <ConfirmationDialog
          cancelLabel={dictionary.actions.cancel}
          confirmTone="primary"
          confirmLabel={dictionary.goals.completeGoal}
          description={dictionary.goals.confirmCompleteGoal}
          open={isArchiveDialogOpen}
          title={dictionary.goals.completeGoal}
          onClose={() => setIsArchiveDialogOpen(false)}
          onConfirm={() => {
            setIsArchiveDialogOpen(false);
            void onComplete?.(goal.id);
          }}
        />
        <ConfirmationDialog
          cancelLabel={dictionary.actions.cancel}
          confirmTone="primary"
          confirmLabel={dictionary.goals.restoreGoal}
          description={dictionary.goals.confirmRestoreGoal}
          open={isRestoreDialogOpen}
          title={dictionary.goals.restoreGoal}
          onClose={() => setIsRestoreDialogOpen(false)}
          onConfirm={() => {
            setIsRestoreDialogOpen(false);
            void onRestore?.(goal.id);
          }}
        />
        <ConfirmationDialog
          cancelLabel={dictionary.actions.cancel}
          confirmLabel={dictionary.actions.delete}
          description={dictionary.goals.confirmDeleteGoal}
          open={isDeleteDialogOpen}
          title={dictionary.goals.deleteGoal}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={() => void deleteGoal()}
        />

        <GoalPreview
          categoryTagMap={stepCategoryMap}
          summary={summary}
          tone={progressTone}
        />
      </article>
    </>
  );
}

function CategoryMenuSection({
  label,
  surface,
  onAssign,
  onJoinShapeChange,
}: {
  label: string;
  surface: CategoryTagSurface;
  onAssign: (categoryTagId: string) => Promise<void> | void;
  onJoinShapeChange: (shape: DropdownJoinShape | null) => void;
}) {
  const { scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, surface);
  const [isExpanded, setIsExpanded] = useState(false);
  const [joinShape, setJoinShape] = useState<DropdownJoinShape | null>(null);
  const [submenuStyle, setSubmenuStyle] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignableCategoryTags = categoryTags.filter((tag) => !tag.useOwnName);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setJoinShape(null);
      onJoinShapeChange(null);
      closeTimeoutRef.current = null;
    }, 120);
  }, [cancelScheduledClose, onJoinShapeChange]);

  const updateSubmenuPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const actionsMenuRect = trigger
      .closest<HTMLElement>('[data-card-actions-menu="true"]')
      ?.getBoundingClientRect();
    const submenuLeft =
      (actionsMenuRect?.right ?? triggerRect.right) - dropdownJoinOverlap;

    setSubmenuStyle({
      left: submenuLeft,
      top: triggerRect.top + triggerRect.height / 2,
    });
  }, []);

  const openSubmenu = useCallback(() => {
    cancelScheduledClose();
    updateSubmenuPosition();
    setIsExpanded(true);
  }, [cancelScheduledClose, updateSubmenuPosition]);

  const updateJoinShape = useCallback(() => {
    const trigger = triggerRef.current;
    const submenu = submenuRef.current;
    const mainMenu = trigger?.closest<HTMLElement>(
      '[data-card-actions-menu="true"]',
    );

    if (!mainMenu || !submenu) {
      return;
    }

    const nextShape = getDropdownJoinShape(
      mainMenu.getBoundingClientRect().height,
      submenu.getBoundingClientRect().height,
    );
    setJoinShape(nextShape);
    onJoinShapeChange(nextShape);
  }, [onJoinShapeChange]);

  useLayoutEffect(() => {
    if (!isExpanded || !submenuStyle) {
      return;
    }

    updateJoinShape();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateJoinShape);
    const mainMenu = triggerRef.current?.closest<HTMLElement>(
      '[data-card-actions-menu="true"]',
    );
    const submenu = submenuRef.current;

    if (mainMenu) observer.observe(mainMenu);
    if (submenu) observer.observe(submenu);

    return () => observer.disconnect();
  }, [isExpanded, submenuStyle, updateJoinShape]);

  useEffect(
    () => () => {
      cancelScheduledClose();
    },
    [cancelScheduledClose],
  );

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    function updatePosition() {
      updateSubmenuPosition();
      updateJoinShape();
    }

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isExpanded, updateJoinShape, updateSubmenuPosition]);

  useEffect(
    () => () => {
      onJoinShapeChange(null);
    },
    [onJoinShapeChange],
  );

  if (assignableCategoryTags.length === 0) {
    return null;
  }

  const submenu =
    isExpanded && submenuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={submenuRef}
            data-goal-category-submenu="true"
            className={`dropdown-extension-panel modal-panel modal-panel--flat fixed z-50 min-w-52 text-sm shadow-[0_24px_70px_rgba(5,8,13,0.44)] ${
              joinShape === 'extension-taller'
                ? 'dropdown-extension-panel--rounded-left'
                : 'rounded-l-none'
            }`}
            style={{ ...submenuStyle, transform: 'translateY(-50%)' }}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.stopPropagation()}
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={(event) => {
              const nextTarget = event.relatedTarget;

              if (
                !(nextTarget instanceof Node) ||
                !triggerRef.current?.contains(nextTarget)
              ) {
                scheduleClose();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="dropdown-extension-panel__content grid max-h-[min(20rem,calc(100vh-2rem))] gap-1 overflow-y-auto p-2">
              {assignableCategoryTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[#fff9f2] transition hover:bg-white/[0.08]"
                  onClick={() => void onAssign(tag.id)}
                >
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.colorHex }}
                  />
                  <span className="truncate">{tag.name}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative grid">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isExpanded}
          aria-haspopup="menu"
          className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left font-medium text-[#fff9f2] transition hover:bg-white/[0.08]"
          onClick={openSubmenu}
          onFocus={openSubmenu}
          onMouseEnter={openSubmenu}
          onMouseLeave={(event) => {
            const nextTarget = event.relatedTarget;

            if (
              !(nextTarget instanceof Node) ||
              !submenuRef.current?.contains(nextTarget)
            ) {
              scheduleClose();
            }
          }}
        >
          <Tag aria-hidden="true" className="size-4" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </button>
      </div>
      {submenu}
    </>
  );
}

function MoveGoalMenu({
  currentGroupId,
  groups,
  onMove,
}: {
  currentGroupId: string | null;
  groups: GoalGroup[];
  onMove: (groupId: string | null) => Promise<void> | void;
}) {
  const { dictionary } = useAppContext();
  const movableGroups = groups.filter(
    (group) => group.id !== currentGroupId && group.title.trim().length > 0,
  );

  if (movableGroups.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-1 border-t border-white/10 pt-1">
      <span className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#aebac8]">
        {dictionary.goals.moveTo}
      </span>
      {movableGroups.map((group) => (
        <button
          key={group.id}
          type="button"
          className="rounded-xl px-2 py-2 text-left font-medium text-[#fff9f2] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => void onMove(group.id)}
        >
          {group.title}
        </button>
      ))}
    </div>
  );
}

function GoalPreview({
  categoryTagMap,
  summary,
  tone,
}: {
  categoryTagMap: Map<string, CategoryTag>;
  summary: GoalStepSummary;
  tone: ReturnType<typeof getProgressTone>;
}) {
  if (summary.itemCount === 0) {
    return null;
  }

  const hiddenCount = Math.max(
    0,
    summary.categoryTagIds.length - visibleCategoryLimit,
  );

  return (
    <div className="mt-auto grid gap-2">
      <span
        className="w-fit rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-2 py-1 text-[11px] font-semibold leading-none tabular-nums text-[#f7e8ce]"
        style={tone.badgeStyle}
      >
        {summary.completedCount}/{summary.itemCount}
      </span>
      <span
        className="h-2 w-full overflow-hidden rounded-full bg-white/6"
        style={tone.trackStyle}
      >
        <span
          className="block h-full rounded-full transition-[width] duration-200"
          style={{
            ...tone.fillStyle,
            width: `${Math.round((summary.completedCount / summary.itemCount) * 100)}%`,
          }}
        />
      </span>
      {summary.categoryTagIds.length > 0 ? (
        <span className="flex items-center gap-1.5 pt-0.5">
          {summary.categoryTagIds.slice(0, visibleCategoryLimit).map((id) => {
            const colorHex = categoryTagMap.get(id)?.colorHex;

            return (
              <span
                key={id}
                className="size-3 rounded-full inset-ring-hairline inset-ring-white/35 transition-opacity"
                style={{
                  backgroundColor: colorHex,
                  opacity: isCategoryComplete(summary, id) ? 1 : 0.28,
                  boxShadow:
                    isCategoryComplete(summary, id) && colorHex
                      ? `0 0 0 1px rgba(255, 255, 255, 0.28), 0 0 10px ${colorHex}33`
                      : 'none',
                }}
              />
            );
          })}
          {hiddenCount > 0 ? (
            <span className="text-[11px] font-semibold text-[#aebac8]">
              +{hiddenCount}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

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

function GoalGroupDetailHeader({
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

function GoalDetailHeader({
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

function ArchivedGoalDetailCard({
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
      className="flex min-h-0 flex-col rounded-[1.25rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(5,8,13,0.16)] sm:p-4"
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

function GoalDetailCard({
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
  const selectedCompletionState = getSelectionCompletionState(
    selectedGoalSteps.map((goalStep) => ({
      completed: goalStep.completed,
      ignored: goalStep.ignored,
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
      className="flex min-h-0 flex-col gap-3 rounded-[1.25rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(5,8,13,0.16)] sm:p-4"
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
            completionState={selectedCompletionState}
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

function GoalStepRow({
  actionPreferences,
  categoryTagMap,
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
      ignored={goalStep.ignored}
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
      selection={{
        isSelected,
        isSelectionMode,
        onBulkAssignCategory,
        onBulkDelete,
        onBulkToggleChecked,
        onToggle: (shiftKey) => onToggleSelect(goalStep.id, shiftKey),
      }}
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
      onToggleChecked={() =>
        isDraft
          ? Promise.resolve()
          : toggleGoalStepChecked({ scope, goalStepId: goalStep.id })
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
