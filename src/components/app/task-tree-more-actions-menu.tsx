'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  IndentDecrease,
  IndentIncrease,
  MoreHorizontal,
  Plus,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { IconButton } from '@/components/ui';
import {
  getDropdownJoinShape,
  dropdownJoinOverlap,
  type DropdownJoinShape,
} from './dropdown-join-shape';
import { TaskTreeClearCategoryIcon } from './task-tree-clear-category-icon';
import type { TaskTreeRowActionPreferences } from './task-tree-row-action-visibility';

const menuWidth = 248;
const menuOffset = 8;
const viewportPadding = 12;

interface TaskTreeMoreActionsLabels {
  addChild: string;
  assignCategory: string;
  bulkBold: string;
  bulkCategory: string;
  bulkDelete: string;
  bulkPriority: string;
  clearCategory: string;
  deleteItem: string;
  makeTextBold: string;
  makeTextNormal: string;
  markPriority: string;
  moveItemDown: string;
  moveItemUp: string;
  moreActions: string;
  indentItem: string;
  outdentItem: string;
  unmarkPriority: string;
}

export function TaskTreeMoreActionsMenu({
  actionPreferences,
  bold,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  categoryTagMap,
  disabled = false,
  labels,
  priority,
  selectedCategoryTagId,
  onAdd,
  onAssignCategory,
  onDelete,
  onIndent,
  onMoveDown,
  onMoveUp,
  onOutdent,
  onToggleBold,
  onTogglePriority,
}: {
  actionPreferences: TaskTreeRowActionPreferences;
  bold: boolean;
  canIndent: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  canOutdent: boolean;
  categoryTagMap: Map<
    string,
    { colorHex: string; name: string; useOwnName?: boolean }
  >;
  disabled?: boolean;
  labels: TaskTreeMoreActionsLabels;
  priority: boolean;
  selectedCategoryTagId: string | null;
  onAdd: () => Promise<void> | void;
  onAssignCategory: (categoryTagId: string | null) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onIndent: () => Promise<void> | void;
  onMoveDown: () => Promise<void> | void;
  onMoveUp: () => Promise<void> | void;
  onOutdent: () => Promise<void> | void;
  onToggleBold: () => Promise<void> | void;
  onTogglePriority: () => Promise<void> | void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [categorySubmenuStyle, setCategorySubmenuStyle] =
    useState<CSSProperties | null>(null);
  const [categoryJoinShape, setCategoryJoinShape] =
    useState<DropdownJoinShape | null>(null);
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
  const isInMenu = (action: keyof TaskTreeRowActionPreferences): boolean =>
    actionPreferences[action] === 'menu';

  const closeMenu = useCallback(
    ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
      setIsOpen(false);
      setIsCategoryExpanded(false);
      setMenuStyle(null);
      setCategorySubmenuStyle(null);
      setCategoryJoinShape(null);

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
      setCategoryJoinShape(null);
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
      left: (actionsMenuRect?.right ?? triggerRect.right) - dropdownJoinOverlap,
      top: triggerRect.top + triggerRect.height / 2,
    });
  }, []);

  const openCategorySubmenu = useCallback(() => {
    cancelScheduledCategoryClose();
    updateCategorySubmenuPosition();
    setIsCategoryExpanded(true);
  }, [cancelScheduledCategoryClose, updateCategorySubmenuPosition]);

  const updateCategoryJoinShape = useCallback(() => {
    const mainMenu = menuRef.current;
    const categorySubmenu = categorySubmenuRef.current;

    if (!mainMenu || !categorySubmenu) {
      return;
    }

    setCategoryJoinShape(
      getDropdownJoinShape(
        mainMenu.getBoundingClientRect().height,
        categorySubmenu.getBoundingClientRect().height,
      ),
    );
  }, []);

  useLayoutEffect(() => {
    if (!isCategoryExpanded || !categorySubmenuStyle) {
      return;
    }

    updateCategoryJoinShape();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateCategoryJoinShape);
    const mainMenu = menuRef.current;
    const categorySubmenu = categorySubmenuRef.current;

    if (mainMenu) observer.observe(mainMenu);
    if (categorySubmenu) observer.observe(categorySubmenu);

    return () => observer.disconnect();
  }, [categorySubmenuStyle, isCategoryExpanded, updateCategoryJoinShape]);

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
        updateCategoryJoinShape();
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
    updateCategoryJoinShape,
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
            className={`dropdown-extension-panel modal-panel modal-panel--flat fixed z-50 min-w-52 text-sm shadow-[0_24px_70px_rgba(8,6,20,0.44)] ${
              categoryJoinShape === 'extension-taller'
                ? 'dropdown-extension-panel--rounded-left'
                : 'rounded-l-none'
            }`}
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
            <div className="dropdown-extension-panel__content grid max-h-[min(20rem,calc(100vh-2rem))] gap-1 overflow-y-auto p-2">
              {categories.map(([categoryTagId, category]) => (
                <button
                  key={categoryTagId}
                  type="button"
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[#fff9f2] transition hover:bg-white/[0.08]"
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
            </div>
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
            className={`modal-panel modal-panel--flat fixed z-60 grid max-h-[min(28rem,calc(100vh-1.5rem))] gap-1 overflow-y-auto p-2 shadow-[0_24px_70px_rgba(8,6,20,0.44)] ${
              isCategoryExpanded ? 'dropdown-joined-main' : ''
            } ${
              categoryJoinShape && categoryJoinShape !== 'main-taller'
                ? 'rounded-r-none'
                : ''
            }`}
            style={menuStyle}
          >
            {isInMenu('add') ? (
              <button
                type="button"
                aria-label={labels.addChild}
                className={itemClassName}
                onClick={() => void runAction(onAdd)}
              >
                <Plus aria-hidden="true" className="size-4" />
                <span>{labels.addChild}</span>
              </button>
            ) : null}
            {isInMenu('moveUp') ? (
              <button
                type="button"
                aria-label={labels.moveItemUp}
                className={itemClassName}
                disabled={!canMoveUp}
                onClick={() => void runAction(onMoveUp)}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
                <span>{labels.moveItemUp}</span>
              </button>
            ) : null}
            {isInMenu('moveDown') ? (
              <button
                type="button"
                aria-label={labels.moveItemDown}
                className={itemClassName}
                disabled={!canMoveDown}
                onClick={() => void runAction(onMoveDown)}
              >
                <ArrowDown aria-hidden="true" className="size-4" />
                <span>{labels.moveItemDown}</span>
              </button>
            ) : null}
            {isInMenu('outdent') ? (
              <button
                type="button"
                aria-label={labels.outdentItem}
                className={itemClassName}
                disabled={!canOutdent}
                onClick={() => void runAction(onOutdent)}
              >
                <IndentDecrease aria-hidden="true" className="size-4" />
                <span>{labels.outdentItem}</span>
              </button>
            ) : null}
            {isInMenu('indent') ? (
              <button
                type="button"
                aria-label={labels.indentItem}
                className={itemClassName}
                disabled={!canIndent}
                onClick={() => void runAction(onIndent)}
              >
                <IndentIncrease aria-hidden="true" className="size-4" />
                <span>{labels.indentItem}</span>
              </button>
            ) : null}
            {isInMenu('priority') ? (
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
                <span>{labels.bulkPriority}</span>
              </button>
            ) : null}

            {isInMenu('bold') ? (
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
                <span>{labels.bulkBold}</span>
              </button>
            ) : null}

            {isInMenu('category') ? (
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
                  {labels.bulkCategory}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              </button>
            ) : null}

            {isInMenu('clearCategory') ? (
              <button
                type="button"
                aria-label={labels.clearCategory}
                className={itemClassName}
                disabled={!selectedCategoryTagId}
                onClick={() => void runAction(() => onAssignCategory(null))}
              >
                <TaskTreeClearCategoryIcon />
                <span>{labels.clearCategory}</span>
              </button>
            ) : null}

            {isInMenu('delete') ? (
              <>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  aria-label={labels.deleteItem}
                  className={`${itemClassName} text-rose-200 hover:bg-rose-400/[0.12] hover:text-rose-100`}
                  onClick={() => void runAction(onDelete)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  <span>{labels.bulkDelete}</span>
                </button>
              </>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <IconButton
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-label={labels.moreActions}
        className="mr-1 rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
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
      </IconButton>
      {menu}
      {categorySubmenu}
    </>
  );
}
