'use client';

import {
  Archive,
  FolderPlus,
  GripVertical,
  LogOut,
  Palette,
  RotateCcw,
  Trash2,
} from 'lucide-react';
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
import { ConfirmationDialog, Tooltip } from '@/components/ui';
import { GoalCardMenuTrigger } from './goal-card-menu-trigger';
import { canUseOwnName } from '@/features/categories';
import { formatCountLabel, formatProgressLabel } from '@/lib/i18n';
import { assignGoalCategory, softDeleteGoal } from '@/lib/db';
import type { CategoryTag, Goal, GoalGroup } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { type GoalStepSummary } from './use-goal-step-summaries';
import { DragPayload, DragTarget, isSameDragPayload } from './goal-drag-target';
import {
  neutralProgressTrackStyle,
  ignoredProgressFillStyle,
  goalMenuItemClassName,
  goalMenuDangerItemClassName,
  getProgressBadgeStyle,
} from './goal-card-styles';
import {
  DropTargetOverlay,
  PositionIndicator,
} from './goals-overview-controls';
import {
  CategoryAccent,
  applyOwnColorCategory,
} from './goal-category-controls';
import { CategoryMenuSection, MoveGoalMenu } from './goal-category-menu';

export function GoalCard({
  activeDragPayload,
  archived,
  dragTarget,
  goal,
  goalCategory,
  groups,
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
  const progressBadgeStyle = getProgressBadgeStyle(summary);
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
                className="touch-target inline-flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-full inset-ring-hairline inset-ring-white/10 bg-white/[0.045] text-[#aebac8] transition hover:-translate-y-0.5 hover:inset-ring-[#f0c38e]/50 hover:bg-[#f0c38e]/14 hover:text-[#fff9f2] hover:shadow-[0_10px_22px_rgba(240,195,142,0.16)] active:translate-y-0 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
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
            whenTruncated
          >
            <span className="min-w-0 truncate text-base font-semibold leading-tight text-[#fff9f2]">
              {goal.title || dictionary.goals.newGoalTitle}
            </span>
          </Tooltip>
          {goalCategory &&
          !goalCategory.useOwnName &&
          goalCategory.name.trim().length > 0 ? (
            <Tooltip
              className="max-w-[40%] shrink"
              content={goalCategory.name}
              whenTruncated
            >
              <span
                className="min-w-0 truncate text-xs font-semibold leading-tight"
                style={{ color: goalCategory.colorHex }}
              >
                {goalCategory.name}
              </span>
            </Tooltip>
          ) : null}
          <GoalCardMenuTrigger
            ref={triggerRef}
            aria-expanded={isMenuOpen}
            aria-label={dictionary.goals.goalMenu}
            onClick={(event) => {
              event.stopPropagation();
              if (isMenuOpen) {
                closeMenu();
                return;
              }

              setMenuStyle(getMenuStyle());
              setIsMenuOpen(true);
            }}
          />
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

        <GoalPreview badgeStyle={progressBadgeStyle} summary={summary} />
      </article>
    </>
  );
}

function GoalPreview({
  badgeStyle,
  summary,
}: {
  badgeStyle: CSSProperties;
  summary: GoalStepSummary;
}) {
  const { dictionary } = useAppContext();
  const hasCountedSteps = summary.itemCount > 0;
  const hasSummary = hasCountedSteps || summary.ignoredCount > 0;

  return (
    <div className="mt-auto grid gap-2 pt-2">
      {hasSummary ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {hasCountedSteps ? (
            <span
              className="rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-2 py-1 text-[11px] font-semibold leading-none tabular-nums text-[#f7e8ce]"
              style={badgeStyle}
            >
              {formatProgressLabel({
                completed: summary.completedCount,
                plural: dictionary.goals.goalProgressSteps,
                singular: dictionary.goals.goalProgressStep,
                total: summary.itemCount,
              })}
            </span>
          ) : null}
          {summary.ignoredCount > 0 ? (
            <>
              {hasCountedSteps ? (
                <span aria-hidden="true" className="text-[11px] text-[#63748a]">
                  ·
                </span>
              ) : null}
              <span className="text-[11px] font-medium leading-none tabular-nums text-[#8fa0b3]">
                {formatCountLabel({
                  count: summary.ignoredCount,
                  plural: dictionary.goals.ignoredSteps,
                  singular: dictionary.goals.ignoredStep,
                })}
              </span>
            </>
          ) : null}
        </span>
      ) : null}
      <span
        className="flex h-1 w-full overflow-hidden rounded-full"
        data-testid="goal-progress-track"
        style={neutralProgressTrackStyle}
      >
        {hasCountedSteps ? (
          <span
            className="block min-w-0 basis-0 overflow-hidden"
            data-testid="goal-progress-counted-segment"
            style={{ flexGrow: summary.itemCount }}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-200"
              data-testid="goal-progress-fill"
              style={{
                backgroundColor: badgeStyle.backgroundColor,
                width: `${Math.round((summary.completedCount / summary.itemCount) * 100)}%`,
              }}
            />
          </span>
        ) : null}
        {summary.ignoredCount > 0 ? (
          <span
            className="block min-w-0 basis-0"
            data-testid="goal-progress-ignored-segment"
            style={{
              ...ignoredProgressFillStyle,
              flexGrow: summary.ignoredCount,
            }}
          />
        ) : null}
      </span>
    </div>
  );
}
