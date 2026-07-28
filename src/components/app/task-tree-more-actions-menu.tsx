'use client';

import {
  ChevronRight,
  MoreHorizontal,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

const menuWidth = 248;
const menuOffset = 8;
const viewportPadding = 12;

interface TaskTreeMoreActionsLabels {
  assignCategory: string;
  clearCategory: string;
  deleteItem: string;
  makeTextBold: string;
  makeTextNormal: string;
  markPriority: string;
  moreActions: string;
  unmarkPriority: string;
}

export function TaskTreeMoreActionsMenu({
  bold,
  categoryTagMap,
  disabled = false,
  labels,
  priority,
  selectedCategoryTagId,
  onAssignCategory,
  onDelete,
  onToggleBold,
  onTogglePriority,
}: {
  bold: boolean;
  categoryTagMap: Map<
    string,
    { colorHex: string; name: string; useOwnName?: boolean }
  >;
  disabled?: boolean;
  labels: TaskTreeMoreActionsLabels;
  priority: boolean;
  selectedCategoryTagId: string | null;
  onAssignCategory: (categoryTagId: string | null) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onToggleBold: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [categorySubmenuStyle, setCategorySubmenuStyle] =
    useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const categorySubmenuRef = useRef<HTMLDivElement | null>(null);
  const categoryCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const categories = [...categoryTagMap.entries()].filter(
    ([, category]) => !category.useOwnName,
  );

  const closeMenu = useCallback(
    ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
      setIsOpen(false);
      setIsCategoryExpanded(false);
      setMenuStyle(null);
      setCategorySubmenuStyle(null);

      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    },
    [],
  );

  const getMenuStyle = useCallback((): CSSProperties | null => {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === 'undefined') {
      return null;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(
      menuWidth,
      Math.max(0, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - viewportPadding - width,
    );
    const estimatedHeight = Math.min(
      230 + categories.length * 40,
      window.innerHeight - viewportPadding * 2,
    );

    if (
      rect.bottom + menuOffset + estimatedHeight >
        window.innerHeight - viewportPadding &&
      rect.top > window.innerHeight - rect.bottom
    ) {
      return {
        bottom: Math.max(
          viewportPadding,
          window.innerHeight - rect.top + menuOffset,
        ),
        left,
        width,
      };
    }

    return {
      left,
      top: Math.max(viewportPadding, rect.bottom + menuOffset),
      width,
    };
  }, [categories.length]);

  const cancelScheduledCategoryClose = useCallback(() => {
    if (categoryCloseTimeoutRef.current !== null) {
      clearTimeout(categoryCloseTimeoutRef.current);
      categoryCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleCategoryClose = useCallback(() => {
    cancelScheduledCategoryClose();
    categoryCloseTimeoutRef.current = setTimeout(() => {
      setIsCategoryExpanded(false);
      categoryCloseTimeoutRef.current = null;
    }, 120);
  }, [cancelScheduledCategoryClose]);

  const updateCategorySubmenuPosition = useCallback(() => {
    const categoryTrigger = categoryTriggerRef.current;

    if (!categoryTrigger) {
      return;
    }

    const triggerRect = categoryTrigger.getBoundingClientRect();
    const actionsMenuRect = categoryTrigger
      .closest<HTMLElement>('[data-task-actions-menu="true"]')
      ?.getBoundingClientRect();

    setCategorySubmenuStyle({
      left: actionsMenuRect?.right ?? triggerRect.right,
      top: triggerRect.top + triggerRect.height / 2,
    });
  }, []);

  const openCategorySubmenu = useCallback(() => {
    cancelScheduledCategoryClose();
    updateCategorySubmenuPosition();
    setIsCategoryExpanded(true);
  }, [cancelScheduledCategoryClose, updateCategorySubmenuPosition]);

  useEffect(
    () => () => {
      cancelScheduledCategoryClose();
    },
    [cancelScheduledCategoryClose],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target) &&
        !categorySubmenuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu({ restoreFocus: true });
      }
    }

    function handleViewportChange() {
      const nextMenuStyle = getMenuStyle();

      if (nextMenuStyle) {
        setMenuStyle(nextMenuStyle);
      }

      if (isCategoryExpanded) {
        updateCategorySubmenuPosition();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [
    closeMenu,
    getMenuStyle,
    isCategoryExpanded,
    isOpen,
    updateCategorySubmenuPosition,
  ]);

  async function runAction(action: () => Promise<void> | void) {
    await action();
    closeMenu();
  }

  const itemClassName =
    'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#eee8f7] transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-40';

  const categorySubmenu =
    isCategoryExpanded &&
    categorySubmenuStyle &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={categorySubmenuRef}
            data-task-category-submenu="true"
            className="modal-panel fixed z-70 grid max-h-[min(20rem,calc(100vh-2rem))] min-w-52 gap-1 overflow-y-auto rounded-l-none border-0 p-2 text-sm shadow-[0_24px_70px_rgba(8,6,20,0.44)]"
            style={{
              ...categorySubmenuStyle,
              transform: 'translateY(-50%)',
            }}
            onMouseEnter={cancelScheduledCategoryClose}
            onMouseLeave={(event) => {
              const nextTarget = event.relatedTarget;

              if (
                !(nextTarget instanceof Node) ||
                !categoryTriggerRef.current?.contains(nextTarget)
              ) {
                scheduleCategoryClose();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {categories.map(([categoryTagId, category]) => (
              <button
                key={categoryTagId}
                type="button"
                className={`flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[#fff9f2] transition hover:bg-white/[0.08] ${
                  categoryTagId === selectedCategoryTagId
                    ? 'bg-white/[0.06]'
                    : ''
                }`}
                onClick={() =>
                  void runAction(() => onAssignCategory(categoryTagId))
                }
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.colorHex }}
                />
                <span className="truncate">{category.name}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  const menu =
    isOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            data-task-actions-menu="true"
            className="modal-panel modal-panel--flat fixed z-60 grid max-h-[min(28rem,calc(100vh-1.5rem))] gap-1 overflow-y-auto p-2 shadow-[0_24px_70px_rgba(8,6,20,0.44)]"
            style={menuStyle}
          >
            <button
              type="button"
              aria-label={
                priority ? labels.unmarkPriority : labels.markPriority
              }
              className={itemClassName}
              onClick={() => void runAction(onTogglePriority)}
            >
              <Star
                aria-hidden="true"
                className={`size-4 ${
                  priority ? 'fill-current text-[#f0c38e]' : ''
                }`}
              />
              <span>
                {priority ? labels.unmarkPriority : labels.markPriority}
              </span>
            </button>

            <button
              type="button"
              aria-label={bold ? labels.makeTextNormal : labels.makeTextBold}
              className={itemClassName}
              onClick={() => void runAction(onToggleBold)}
            >
              <span
                aria-hidden="true"
                data-testid="task-bold-indicator"
                className={`flex size-4 items-center justify-center text-base leading-none ${
                  bold ? 'font-bold' : 'font-normal'
                }`}
              >
                B
              </span>
              <span>{bold ? labels.makeTextNormal : labels.makeTextBold}</span>
            </button>

            <button
              ref={categoryTriggerRef}
              type="button"
              aria-expanded={isCategoryExpanded}
              aria-haspopup="menu"
              aria-label={labels.assignCategory}
              className={itemClassName}
              disabled={categories.length === 0}
              onClick={openCategorySubmenu}
              onFocus={openCategorySubmenu}
              onMouseEnter={openCategorySubmenu}
              onMouseLeave={(event) => {
                const nextTarget = event.relatedTarget;

                if (
                  !(nextTarget instanceof Node) ||
                  !categorySubmenuRef.current?.contains(nextTarget)
                ) {
                  scheduleCategoryClose();
                }
              }}
            >
              <Tag aria-hidden="true" className="size-4" />
              <span className="min-w-0 flex-1 truncate">
                {labels.assignCategory}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </button>

            <button
              type="button"
              aria-label={labels.clearCategory}
              className={itemClassName}
              disabled={!selectedCategoryTagId}
              onClick={() => void runAction(() => onAssignCategory(null))}
            >
              <X aria-hidden="true" className="size-4" />
              <span>{labels.clearCategory}</span>
            </button>

            <div className="my-1 border-t border-white/10" />

            <button
              type="button"
              aria-label={labels.deleteItem}
              className={`${itemClassName} text-rose-200 hover:bg-rose-400/[0.12] hover:text-rose-100`}
              onClick={() => void runAction(onDelete)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              <span>{labels.deleteItem}</span>
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-label={labels.moreActions}
        className="mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          setMenuStyle(getMenuStyle());
          setIsOpen(true);
        }}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      {menu}
      {categorySubmenu}
    </>
  );
}
