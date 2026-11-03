'use client';

import { GripVertical, MoreHorizontal, Palette, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  TaskTreeClearCategoryIcon,
  type DropdownJoinShape,
} from '@/components/app';
import { ConfirmationDialog, IconButton, Tooltip } from '@/components/ui';
import { canUseOwnName } from '@/features/categories';
import { toAlphaColor } from '@/lib/color';
import { assignGoalGroupCategory, softDeleteGoalGroup } from '@/lib/db';
import type { CategoryTag, Goal, GoalGroup } from '@/lib/domain';
import { useAppContext } from '@/providers';
import {
  getGoalStepSummary,
  type GoalStepSummary,
} from './use-goal-step-summaries';
import { DragPayload, DragTarget, isSameDragPayload } from './goal-drag-target';
import {
  DropTargetOverlay,
  PositionIndicator,
} from './goals-overview-controls';
import {
  CategoryAccent,
  applyOwnColorCategory,
} from './goal-category-controls';
import { CategoryMenuSection } from './goal-category-menu';

export function GoalGroupCard({
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
              className="touch-target inline-flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-full inset-ring-hairline inset-ring-white/10 bg-white/[0.045] text-[#aebac8] transition hover:-translate-y-0.5 hover:inset-ring-[#f0c38e]/50 hover:bg-[#f0c38e]/14 hover:text-[#fff9f2] hover:shadow-[0_10px_22px_rgba(240,195,142,0.16)] active:translate-y-0 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
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
              whenTruncated
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
              <Tooltip
                className="max-w-[45%] shrink"
                content={category.name}
                whenTruncated
              >
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
