'use client';

import { ChevronRight, Tag } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  dropdownJoinOverlap,
  getDropdownJoinShape,
  type DropdownJoinShape,
} from '@/components/app';
import { useCategoryTags } from '@/features/categories';
import type { CategoryTagSurface, GoalGroup } from '@/lib/domain';
import { useAppContext } from '@/providers';

const categorySubmenuMinWidth = 208;

const categorySubmenuViewportPadding = 12;

export function CategoryMenuSection({
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
    const preferredLeft =
      (actionsMenuRect?.right ?? triggerRect.right) - dropdownJoinOverlap;
    const submenuWidth = Math.min(
      categorySubmenuMinWidth,
      window.innerWidth - categorySubmenuViewportPadding * 2,
    );
    const submenuLeft = Math.max(
      categorySubmenuViewportPadding,
      Math.min(
        preferredLeft,
        window.innerWidth - categorySubmenuViewportPadding - submenuWidth,
      ),
    );

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

export function MoveGoalMenu({
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
