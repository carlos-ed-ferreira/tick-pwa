'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useCategoryTags } from '@/features/categories';
import { toAlphaColor } from '@/lib/color';
import {
  completeGoal,
  createGoal,
  createGoalGroup,
  groupGoalsTogether,
  moveGoalToGroup,
  reopenGoal,
} from '@/lib/db';
import { useAppContext } from '@/providers';
import { useGoalGroups } from './use-goal-groups';
import {
  getGoalStepSummary,
  useGoalStepSummaries,
} from './use-goal-step-summaries';
import { useGoalStepTree } from './use-goal-step-tree';
import { useGoals } from './use-goals';
import { useGoalDrag } from './use-goal-drag';
import {
  CreateGoalGroupDialog,
  NewEntityCard,
} from './goals-overview-controls';
import { GoalGroupCard } from './goal-group-card';
import { GoalGrid } from './goal-grid';
import { GoalCard } from './goal-card';
import { GoalGroupDetailHeader, GoalDetailHeader } from './goal-detail-headers';
import { ArchivedGoalDetailCard, GoalDetailCard } from './goal-detail-card';
import {
  GoalsOverviewToolbar,
  type GoalsOverviewView,
} from './goals-overview-toolbar';

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
  const [view, setView] = useState<GoalsOverviewView>('active');
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
  const {
    activeDragPayload,
    dragTarget,
    beginPointerDrag,
    pendingGoalCombine,
    setPendingGoalCombine,
  } = useGoalDrag({
    scope,
    activeGoals,
    groupTitle: dictionary.goals.newGroupName,
  });
  const [pendingSingleGoalGroup, setPendingSingleGoalGroup] = useState<
    string | null
  >(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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
        <GoalsOverviewToolbar view={view} onViewChange={setView} />
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
        )}
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
