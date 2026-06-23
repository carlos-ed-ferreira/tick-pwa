'use client';

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  GripVertical,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type DragEvent,
  type PointerEvent,
} from 'react';
import { TaskTreeEditableRow, TreeListPanel } from '@/components/app';
import { Button, ConfirmationDialog, IconButton, Input } from '@/components/ui';
import { CategoryAssignmentMenu, useCategoryTags } from '@/features/categories';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';
import { useTreeBulkActions } from '@/hooks/use-tree-bulk-actions';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import {
  assignGoalCategory,
  assignGoalGroupCategory,
  assignGoalStepCategory,
  completeGoal,
  createGoal,
  createGoalStep,
  createGoalStepChild,
  groupGoalsTogether,
  indentGoalStep,
  moveGoalToGroup,
  outdentGoalStep,
  reopenGoal,
  reorderGoal,
  reorderGoalGroup,
  reorderGoalStep,
  softDeleteGoal,
  softDeleteGoalStep,
  toggleGoalStepChecked,
  toggleGoalStepCollapsed,
  toggleGoalStepPriority,
  updateGoalGroupTitle,
  updateGoalStepText,
  updateGoalTitle,
} from '@/lib/db';
import type { CategoryTag, Goal, GoalGroup } from '@/lib/domain';
import { createId } from '@/lib/domain';
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

type DragPayload = { id: string; type: 'goal' } | { id: string; type: 'group' };

function encodeDragPayload(payload: DragPayload): string {
  return JSON.stringify(payload);
}

function decodeDragPayload(value: string): DragPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<DragPayload>;

    if (
      (parsed.type === 'goal' || parsed.type === 'group') &&
      typeof parsed.id === 'string'
    ) {
      return parsed as DragPayload;
    }
  } catch {
    return null;
  }

  return null;
}

function getProgressTone(summary: GoalStepSummary) {
  const ratio =
    summary.itemCount > 0 ? summary.completedCount / summary.itemCount : 0;

  if (ratio >= 1 && summary.itemCount > 0) {
    return {
      badgeStyle: {
        color: '#15803d',
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
        borderColor: 'rgba(34, 197, 94, 0.22)',
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
        borderColor: 'rgba(245, 158, 11, 0.24)',
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
      borderColor: 'rgba(113, 113, 122, 0.18)',
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

function createDragBind(payload: DragPayload) {
  return {
    draggable: true,
    onDragStart(event: DragEvent<HTMLElement>) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'application/x-tick-goals',
        encodeDragPayload(payload),
      );
    },
  };
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
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
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
  const archivedGroupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  const touchDragTimerRef = useRef<number | null>(null);
  const touchDragPayloadRef = useRef<DragPayload | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  const beginTouchDrag = useCallback(
    (payload: DragPayload, event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') {
        return;
      }

      if (touchDragTimerRef.current !== null) {
        window.clearTimeout(touchDragTimerRef.current);
      }

      touchDragTimerRef.current = window.setTimeout(() => {
        touchDragPayloadRef.current = payload;
        setIsTouchDragging(true);
      }, 350);
    },
    [],
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
    function clearTouchDragTimer() {
      if (touchDragTimerRef.current !== null) {
        window.clearTimeout(touchDragTimerRef.current);
        touchDragTimerRef.current = null;
      }
    }

    function handlePointerCancel() {
      clearTouchDragTimer();
      touchDragPayloadRef.current = null;
      setIsTouchDragging(false);
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      clearTouchDragTimer();

      const payload = touchDragPayloadRef.current;
      touchDragPayloadRef.current = null;
      setIsTouchDragging(false);

      if (!payload || !scope) {
        return;
      }

      const target = document.elementFromPoint(
        event.clientX,
        event.clientY,
      ) as HTMLElement | null;
      const goalId =
        target?.closest<HTMLElement>('[data-goal-drop-id]')?.dataset
          .goalDropId ?? null;
      const groupId =
        target?.closest<HTMLElement>('[data-group-drop-id]')?.dataset
          .groupDropId ?? null;
      const ungroupedDropZone = target?.closest<HTMLElement>(
        '[data-ungrouped-drop-zone="true"]',
      );

      if (payload.type === 'goal') {
        if (goalId && goalId !== payload.id) {
          void groupGoalsTogether({
            scope,
            sourceGoalId: payload.id,
            targetGoalId: goalId,
            title: dictionary.goals.newGroupName,
          });
          return;
        }

        if (groupId) {
          void moveGoalToGroup({ scope, goalId: payload.id, groupId });
          return;
        }

        if (ungroupedDropZone) {
          void moveGoalToGroup({ scope, goalId: payload.id, groupId: null });
        }
        return;
      }

      if (payload.type === 'group' && groupId && groupId !== payload.id) {
        void reorderGoalGroup({
          scope,
          goalGroupId: payload.id,
          direction:
            groups.findIndex((group) => group.id === payload.id) >
            groups.findIndex((group) => group.id === groupId)
              ? 'up'
              : 'down',
        });
      }
    }

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      clearTouchDragTimer();
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [dictionary.goals.newGroupName, groups, scope]);

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

  async function createGoalCard(groupId: string | null = null) {
    const goal = await createGoal({
      scope: activeScope,
      groupId,
      title: dictionary.goals.newGoalTitle,
    });
    openGoal(goal.id);
  }

  async function handleGoalDrop(
    event: DragEvent<HTMLElement>,
    targetGoal: Goal,
  ) {
    event.preventDefault();
    const payload = decodeDragPayload(
      event.dataTransfer.getData('application/x-tick-goals'),
    );

    if (!payload || payload.type !== 'goal' || payload.id === targetGoal.id) {
      return;
    }

    const group = await groupGoalsTogether({
      scope: activeScope,
      sourceGoalId: payload.id,
      targetGoalId: targetGoal.id,
      title: dictionary.goals.newGroupName,
    });

    if (group) {
      setFocusedGroupId(group.id);
      openGroup(group.id);
    }
  }

  async function handleGroupDrop(
    event: DragEvent<HTMLElement>,
    targetGroup: GoalGroup,
  ) {
    event.preventDefault();
    const payload = decodeDragPayload(
      event.dataTransfer.getData('application/x-tick-goals'),
    );

    if (!payload) {
      return;
    }

    if (payload.type === 'goal') {
      await moveGoalToGroup({
        scope: activeScope,
        goalId: payload.id,
        groupId: targetGroup.id,
      });
      return;
    }

    if (payload.type === 'group' && payload.id !== targetGroup.id) {
      await reorderGoalGroup({
        scope: activeScope,
        goalGroupId: payload.id,
        direction:
          groups.findIndex((group) => group.id === payload.id) >
          groups.findIndex((group) => group.id === targetGroup.id)
            ? 'up'
            : 'down',
      });
    }
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
        />
        <GoalDetailCard
          categoryTagMap={stepCategoryMap}
          goal={selectedGoal}
          goalStepRows={selectedGoalStepRows}
        />
      </section>
    );
  }

  if (selectedGroup) {
    const groupGoals = activeGoals.filter(
      (goal) => goal.groupId === selectedGroup.id,
    );

    return (
      <section className="grid gap-4 pt-4 sm:pt-5 lg:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <button
              type="button"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f8f3ea] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
              onClick={closeNestedView}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {dictionary.goals.backToGoalGroups}
            </button>
            <div className="flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.04] px-4 py-3 shadow-[0_14px_30px_rgba(8,6,20,0.12)]">
              <CategoryAccent
                category={groupCategoryMap.get(
                  selectedGroup.categoryTagId ?? '',
                )}
              />
              <GoalGroupTitleEditor
                autoFocus={focusedGroupId === selectedGroup.id}
                group={selectedGroup}
              />
              <CategoryAssignmentMenu
                assignLabel={dictionary.goals.assignGroupCategory}
                clearLabel={dictionary.dayEditor.clearCategory}
                selectedCategoryTagId={selectedGroup.categoryTagId}
                surface="goal_group"
                onAssign={(categoryTagId) =>
                  assignGoalGroupCategory({
                    scope,
                    goalGroupId: selectedGroup.id,
                    categoryTagId,
                  })
                }
              />
            </div>
          </div>

          <Button
            className="min-h-12 w-fit rounded-full px-5 shadow-[0_16px_32px_rgba(240,195,142,0.18)]"
            tone="accent"
            onClick={() => void createGoalCard(selectedGroup.id)}
          >
            <Plus aria-hidden="true" className="size-4" />
            {dictionary.goals.newGoalTitle}
          </Button>
        </div>

        <GoalSection
          title={selectedGroup.title || dictionary.goals.newGroupName}
          description={String(groupGoals.length)}
        >
          <GoalGrid
            archived={false}
            goals={groupGoals}
            groups={groups}
            goalCategoryMap={goalCategoryMap}
            isTouchDragging={isTouchDragging}
            stepCategoryMap={stepCategoryMap}
            summaries={goalStepSummaries}
            onBeginTouchDrag={beginTouchDrag}
            onComplete={(goalId) => completeGoal({ scope, goalId })}
            onDropGoal={handleGoalDrop}
            onMoveGoal={(goalId, groupId) =>
              moveGoalToGroup({ scope, goalId, groupId })
            }
            onOpenGoal={openGoal}
            onReorderGoal={(goalId, direction) =>
              reorderGoal({ scope, goalId, direction })
            }
          />
        </GoalSection>
      </section>
    );
  }

  return (
    <section className="grid gap-4 pt-4 sm:pt-5 lg:pt-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
          {(['active', 'archived'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
                view === mode
                  ? 'bg-[#f0c38e] text-[#312c51]'
                  : 'text-[#d8d0e8] hover:bg-white/8 hover:text-[#fff9f2]'
              }`}
              onClick={() => setView(mode)}
            >
              {mode === 'active'
                ? dictionary.goals.activeGoals
                : dictionary.goals.archivedGoals}
            </button>
          ))}
        </div>
        {view === 'active' ? (
          <Button
            className="min-h-12 w-fit rounded-full px-5 shadow-[0_16px_32px_rgba(240,195,142,0.18)]"
            tone="accent"
            onClick={() => void createGoalCard(null)}
          >
            <Plus aria-hidden="true" className="size-4" />
            {dictionary.goals.newGoalTitle}
          </Button>
        ) : null}
      </header>

      {view === 'archived' ? (
        <GoalSection
          title={dictionary.goals.archivedGoals}
          description={
            archivedGoals.length > 0 ? String(archivedGoals.length) : undefined
          }
        >
          <GoalGrid
            archived
            goals={archivedGoals}
            groups={groups}
            goalCategoryMap={goalCategoryMap}
            groupById={archivedGroupMap}
            isTouchDragging={isTouchDragging}
            stepCategoryMap={stepCategoryMap}
            summaries={goalStepSummaries}
            onOpenGoal={openGoal}
            onRestore={(goalId) => reopenGoal({ scope, goalId })}
          />
        </GoalSection>
      ) : (
        <div className="grid gap-4">
          {groups.some((group) =>
            activeGoals.some((goal) => goal.groupId === group.id),
          ) ? (
            <GoalSection title={dictionary.goals.groupCategories}>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => {
                  const groupGoals = activeGoals.filter(
                    (goal) => goal.groupId === group.id,
                  );

                  if (groupGoals.length === 0) {
                    return null;
                  }

                  return (
                    <GoalGroupCard
                      key={group.id}
                      category={groupCategoryMap.get(group.categoryTagId ?? '')}
                      goals={groupGoals}
                      group={group}
                      isTouchDragging={isTouchDragging}
                      onBeginTouchDrag={beginTouchDrag}
                      onDropGroup={handleGroupDrop}
                      onOpen={openGroup}
                    />
                  );
                })}
              </div>
            </GoalSection>
          ) : null}

          {ungroupedActiveGoals.length > 0 ? (
            <GoalSection
              title={dictionary.goals.noGroup}
              description={String(ungroupedActiveGoals.length)}
            >
              <div
                className="grid gap-3"
                data-ungrouped-drop-zone="true"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const payload = decodeDragPayload(
                    event.dataTransfer.getData('application/x-tick-goals'),
                  );

                  if (payload?.type === 'goal') {
                    void moveGoalToGroup({
                      scope,
                      goalId: payload.id,
                      groupId: null,
                    });
                  }
                }}
              >
                <GoalGrid
                  archived={false}
                  goals={ungroupedActiveGoals}
                  groups={groups}
                  goalCategoryMap={goalCategoryMap}
                  isTouchDragging={isTouchDragging}
                  stepCategoryMap={stepCategoryMap}
                  summaries={goalStepSummaries}
                  onBeginTouchDrag={beginTouchDrag}
                  onComplete={(goalId) => completeGoal({ scope, goalId })}
                  onDropGoal={handleGoalDrop}
                  onMoveGoal={(goalId, groupId) =>
                    moveGoalToGroup({ scope, goalId, groupId })
                  }
                  onOpenGoal={openGoal}
                  onReorderGoal={(goalId, direction) =>
                    reorderGoal({ scope, goalId, direction })
                  }
                />
              </div>
            </GoalSection>
          ) : null}
        </div>
      )}
    </section>
  );
}

function GoalSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.035] p-4 shadow-[0_18px_44px_rgba(8,6,20,0.12)] sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[#fff9f2] sm:text-lg">
          {title}
        </h2>
        {description ? (
          <span className="text-sm text-[#9f96b8]">{description}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CategoryAccent({
  category,
  position = 'dot',
}: {
  category?: CategoryTag | null;
  position?: 'dot' | 'top';
}) {
  if (!category) {
    return null;
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
      className="size-3 rounded-full border border-white/30"
      style={{ backgroundColor: category.colorHex }}
    />
  );
}

function GoalGroupCard({
  category,
  goals,
  group,
  isTouchDragging,
  onBeginTouchDrag,
  onDropGroup,
  onOpen,
}: {
  category?: CategoryTag | null;
  goals: Goal[];
  group: GoalGroup;
  isTouchDragging: boolean;
  onBeginTouchDrag: (
    payload: DragPayload,
    event: PointerEvent<HTMLElement>,
  ) => void;
  onDropGroup: (
    event: DragEvent<HTMLElement>,
    group: GoalGroup,
  ) => Promise<void>;
  onOpen: (groupId: string) => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <button
      type="button"
      className={`group relative grid min-h-40 gap-3 overflow-hidden rounded-[1.35rem] bg-white/[0.05] p-4 text-left shadow-[0_14px_34px_rgba(8,6,20,0.12)] ring-1 ring-white/[0.08] transition hover:-translate-y-0.5 hover:bg-white/[0.075] hover:ring-[#f0c38e]/25 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
        isTouchDragging ? 'ring-[#f0c38e]/45' : ''
      }`}
      data-group-drop-id={group.id}
      onClick={() => onOpen(group.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => void onDropGroup(event, group)}
      onPointerDown={(event) =>
        onBeginTouchDrag({ type: 'group', id: group.id }, event)
      }
      {...createDragBind({ type: 'group', id: group.id })}
    >
      <CategoryAccent category={category} position="top" />
      <span className="flex min-w-0 items-center gap-2">
        <GripVertical
          aria-hidden="true"
          className="size-4 shrink-0 text-[#9f96b8] opacity-70"
        />
        <span className="truncate text-base font-semibold text-[#fff9f2]">
          {group.title || dictionary.goals.newGroupName}
        </span>
      </span>
      <span className="grid gap-2">
        {goals.map((goal) => (
          <span
            key={goal.id}
            className="truncate rounded-[0.95rem] bg-white/[0.05] px-3 py-2 text-sm font-medium text-[#f8f3ea] ring-1 ring-white/[0.05]"
          >
            {goal.title || dictionary.goals.newGoalTitle}
          </span>
        ))}
      </span>
    </button>
  );
}

function GoalGrid({
  archived,
  goals,
  groups,
  goalCategoryMap,
  groupById,
  isTouchDragging,
  stepCategoryMap,
  summaries,
  onBeginTouchDrag,
  onComplete,
  onDropGoal,
  onMoveGoal,
  onOpenGoal,
  onReorderGoal,
  onRestore,
}: {
  archived: boolean;
  goals: Goal[];
  groups: GoalGroup[];
  goalCategoryMap: Map<string, CategoryTag>;
  groupById?: Map<string, GoalGroup>;
  isTouchDragging: boolean;
  stepCategoryMap: Map<string, CategoryTag>;
  summaries: Map<string, GoalStepSummary>;
  onBeginTouchDrag?: (
    payload: DragPayload,
    event: PointerEvent<HTMLElement>,
  ) => void;
  onComplete?: (goalId: string) => Promise<void> | void;
  onDropGoal?: (event: DragEvent<HTMLElement>, goal: Goal) => Promise<void>;
  onMoveGoal?: (goalId: string, groupId: string | null) => Promise<void> | void;
  onOpenGoal: (goalId: string) => void;
  onReorderGoal?: (
    goalId: string,
    direction: 'up' | 'down',
  ) => Promise<void> | void;
  onRestore?: (goalId: string) => Promise<void> | void;
}) {
  if (goals.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {goals.map((goal, index) => (
        <GoalCard
          key={goal.id}
          archived={archived}
          goal={goal}
          goalCategory={goalCategoryMap.get(goal.categoryTagId ?? '')}
          group={goal.groupId ? groupById?.get(goal.groupId) : undefined}
          groups={groups}
          isFirst={index === 0}
          isLast={index === goals.length - 1}
          isTouchDragging={isTouchDragging}
          stepCategoryMap={stepCategoryMap}
          summary={getGoalStepSummary(summaries, goal.id)}
          onBeginTouchDrag={onBeginTouchDrag}
          onComplete={onComplete}
          onDropGoal={onDropGoal}
          onMoveGoal={onMoveGoal}
          onOpen={onOpenGoal}
          onReorder={onReorderGoal}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}

function GoalCard({
  archived,
  goal,
  goalCategory,
  group,
  groups,
  isFirst,
  isLast,
  isTouchDragging,
  stepCategoryMap,
  summary,
  onBeginTouchDrag,
  onComplete,
  onDropGoal,
  onMoveGoal,
  onOpen,
  onReorder,
  onRestore,
}: {
  archived: boolean;
  goal: Goal;
  goalCategory?: CategoryTag | null;
  group?: GoalGroup;
  groups: GoalGroup[];
  isFirst: boolean;
  isLast: boolean;
  isTouchDragging: boolean;
  stepCategoryMap: Map<string, CategoryTag>;
  summary: GoalStepSummary;
  onBeginTouchDrag?: (
    payload: DragPayload,
    event: PointerEvent<HTMLElement>,
  ) => void;
  onComplete?: (goalId: string) => Promise<void> | void;
  onDropGoal?: (event: DragEvent<HTMLElement>, goal: Goal) => Promise<void>;
  onMoveGoal?: (goalId: string, groupId: string | null) => Promise<void> | void;
  onOpen: (goalId: string) => void;
  onReorder?: (
    goalId: string,
    direction: 'up' | 'down',
  ) => Promise<void> | void;
  onRestore?: (goalId: string) => Promise<void> | void;
}) {
  const { dictionary } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const progressTone = getProgressTone(summary);

  return (
    <article
      className={`group relative grid min-h-40 gap-3 overflow-hidden rounded-[1.35rem] bg-white/[0.055] p-4 text-left shadow-[0_14px_34px_rgba(8,6,20,0.12)] ring-1 ring-white/[0.08] transition hover:-translate-y-0.5 hover:bg-white/[0.08] hover:ring-[#f0c38e]/25 ${
        archived ? 'opacity-95' : ''
      } ${isTouchDragging && !archived ? 'ring-[#f0c38e]/45' : ''}`}
      data-goal-drop-id={archived ? undefined : goal.id}
      onDragOver={(event) => {
        if (!archived) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (!archived && onDropGoal) {
          void onDropGoal(event, goal);
        }
      }}
    >
      <CategoryAccent category={goalCategory} position="top" />
      <div className="flex min-w-0 items-start gap-2">
        {!archived ? (
          <button
            type="button"
            aria-label={dictionary.goals.dragGoal}
            className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[#9f96b8] transition hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
            onPointerDown={(event) =>
              onBeginTouchDrag?.({ type: 'goal', id: goal.id }, event)
            }
            {...createDragBind({ type: 'goal', id: goal.id })}
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="min-w-0 flex-1 rounded-[0.9rem] text-left text-lg font-semibold leading-tight text-[#fff9f2] transition hover:text-[#f8dfbd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
          onClick={() => onOpen(goal.id)}
        >
          <span className="line-clamp-2">
            {goal.title || dictionary.goals.newGoalTitle}
          </span>
        </button>
        <div className="relative">
          <IconButton
            aria-expanded={isMenuOpen}
            aria-label={dictionary.goals.goalMenu}
            className="size-8 rounded-full text-[#bdb4d4] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </IconButton>
          {isMenuOpen ? (
            <div className="modal-panel absolute right-0 top-10 z-20 grid min-w-48 gap-1 p-2 text-sm">
              {!archived && onComplete ? (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[#f8f3ea] hover:bg-white/[0.08]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void onComplete(goal.id);
                  }}
                >
                  <Check aria-hidden="true" className="size-4" />
                  {dictionary.goals.completeGoal}
                </button>
              ) : null}
              {archived && onRestore ? (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[#f8f3ea] hover:bg-white/[0.08]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void onRestore(goal.id);
                  }}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  {dictionary.goals.restoreGoal}
                </button>
              ) : null}
              {!archived && onMoveGoal ? (
                <MoveGoalMenu
                  currentGroupId={goal.groupId}
                  groups={groups}
                  onMove={(groupId) => {
                    setIsMenuOpen(false);
                    return onMoveGoal(goal.id, groupId);
                  }}
                />
              ) : null}
              {!archived && onReorder ? (
                <div className="flex gap-1 px-1 pt-1">
                  <IconButton
                    aria-label={dictionary.dayEditor.moveItemUp}
                    className="size-8 rounded-full"
                    disabled={isFirst}
                    onClick={() => {
                      setIsMenuOpen(false);
                      void onReorder(goal.id, 'up');
                    }}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </IconButton>
                  <IconButton
                    aria-label={dictionary.dayEditor.moveItemDown}
                    className="size-8 rounded-full"
                    disabled={isLast}
                    onClick={() => {
                      setIsMenuOpen(false);
                      void onReorder(goal.id, 'down');
                    }}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </IconButton>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <GoalPreview
        categoryTagMap={stepCategoryMap}
        summary={summary}
        tone={progressTone}
      />

      {archived && group ? (
        <span className="text-xs font-medium text-[#bdb4d4]">
          {dictionary.goals.originGroup}: {group.title}
        </span>
      ) : null}
    </article>
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

  return (
    <div className="grid gap-1 border-t border-white/10 pt-1">
      <span className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#9f96b8]">
        {dictionary.goals.moveTo}
      </span>
      <button
        type="button"
        disabled={currentGroupId === null}
        className="rounded-xl px-2 py-2 text-left text-[#f8f3ea] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => void onMove(null)}
      >
        {dictionary.goals.noGroup}
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          disabled={currentGroupId === group.id}
          className="rounded-xl px-2 py-2 text-left text-[#f8f3ea] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
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
        className="w-fit rounded-full border px-2 py-1 text-[11px] font-semibold leading-none tabular-nums text-[#f7e8ce]"
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
                className="size-3 rounded-full border border-white/35 transition-opacity"
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
            <span className="text-[11px] font-semibold text-[#bdb4d4]">
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

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [autoFocus]);

  return (
    <Input
      ref={inputRef}
      aria-label={dictionary.goals.renameGroup}
      className="min-w-0 flex-1 rounded-md bg-transparent px-0 py-1 text-2xl font-semibold text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] focus:bg-white/[0.04] focus:px-3 focus:ring-1 focus:ring-[#f0c38e]/35"
      placeholder={dictionary.goals.groupTitlePlaceholder}
      value={editableTitle}
      onBlur={() => void flushTitle()}
      onChange={(event) => setTitle(event.target.value.toUpperCase())}
    />
  );
}

function GoalDetailHeader({
  goal,
  goalCategoryMap,
  hasGoalSteps,
  isArchived,
  onBack,
  onDelete,
}: {
  goal: Goal;
  goalCategoryMap: Map<string, CategoryTag>;
  hasGoalSteps: boolean;
  isArchived: boolean;
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
          <CategoryAssignmentMenu
            assignLabel={dictionary.goals.assignGoalCategory}
            clearLabel={dictionary.dayEditor.clearCategory}
            selectedCategoryTagId={goal.categoryTagId}
            surface="goal"
            onAssign={(categoryTagId) => {
              if (!scope) return;
              return assignGoalCategory({
                scope,
                goalId: goal.id,
                categoryTagId,
              });
            }}
          />
          <CategoryAccent
            category={goalCategoryMap.get(goal.categoryTagId ?? '')}
          />
          {!isArchived ? (
            <IconButton
              aria-label={dictionary.goals.completeGoal}
              className="size-10 rounded-md border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/18 hover:text-emerald-50 focus-visible:outline-emerald-200"
              onClick={() => {
                if (scope) void completeGoal({ scope, goalId: goal.id });
              }}
            >
              <Check aria-hidden="true" className="size-4" />
            </IconButton>
          ) : (
            <IconButton
              aria-label={dictionary.goals.restoreGoal}
              className="size-10 rounded-md border border-[#f0c38e]/25 bg-[#f0c38e]/10 text-[#f7d7ad] hover:bg-[#f0c38e]/18 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              onClick={() => {
                if (scope) void reopenGoal({ scope, goalId: goal.id });
              }}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </IconButton>
          )}
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

  return (
    <Input
      aria-label={dictionary.goals.renameGoal}
      className="min-w-0 flex-1 rounded-md bg-transparent px-0 py-1 text-2xl font-semibold text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] focus:bg-white/[0.04] focus:px-3 focus:ring-1 focus:ring-[#f0c38e]/35"
      placeholder={dictionary.goals.goalTitlePlaceholder}
      value={editableTitle}
      onBlur={() => void flushTitle()}
      onChange={(event) => setTitle(event.target.value.toUpperCase())}
    />
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
        emptyLabel={dictionary.goals.emptyGoal}
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
      surface="goal_step"
      text={goalStep.text}
      onAssignCategory={(categoryTagId) =>
        assignGoalStepCategory({
          scope,
          goalStepId: goalStep.id,
          categoryTagId,
        })
      }
      onCreateChild={async () => {
        const newStep = await createGoalStepChild({
          scope,
          goalId,
          parentGoalStepId: goalStep.id,
        });

        return newStep.id;
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
