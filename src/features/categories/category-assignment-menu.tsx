'use client';

import { Palette, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { CategoryTagSurface } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { useCategoryTags } from './use-category-tags';

const menuOffset = 8;
const viewportPadding = 16;
const menuPreferredWidth = 248;

export function CategoryAssignmentMenu({
  assignLabel,
  clearClassName,
  clearLabel,
  disabled,
  renderTriggerContent,
  selectedCategoryTagId,
  showClearInMenu = false,
  surface,
  triggerClassName,
  triggerStyle,
  onAssign,
}: {
  assignLabel: string;
  clearClassName?: string;
  clearLabel: string;
  disabled?: boolean;
  renderTriggerContent?: (args: {
    isOpen: boolean;
    selectedCategory: {
      colorHex: string;
      id: string;
      name: string;
    } | null;
  }) => ReactNode;
  selectedCategoryTagId: string | null;
  showClearInMenu?: boolean;
  surface: CategoryTagSurface;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  onAssign: (categoryTagId: string | null) => Promise<void> | void;
}) {
  const { scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, surface);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedCategory = categoryTags.find(
    (tag) => tag.id === selectedCategoryTagId,
  );
  // Own-name categories are managed through the dedicated color control, not
  // this selector, so they never show up in the assignable list.
  const assignableCategoryTags = categoryTags.filter((tag) => !tag.useOwnName);

  const getMenuStyle = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === 'undefined') {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = Math.min(
      menuPreferredWidth,
      Math.max(0, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.left),
      window.innerWidth - viewportPadding - menuWidth,
    );
    const estimatedMenuHeight = Math.min(
      16 + (assignableCategoryTags.length + (showClearInMenu ? 1 : 0)) * 40,
      window.innerHeight - viewportPadding * 2,
    );
    const shouldOpenUpward =
      triggerRect.bottom + menuOffset + estimatedMenuHeight >
        window.innerHeight - viewportPadding &&
      triggerRect.top > window.innerHeight - triggerRect.bottom;
    const width = menuWidth;

    if (shouldOpenUpward) {
      return {
        bottom: Math.max(
          viewportPadding,
          window.innerHeight - triggerRect.top + menuOffset,
        ),
        left,
        width,
      };
    }

    return {
      left,
      top: Math.max(viewportPadding, triggerRect.bottom + menuOffset),
      width,
    };
  }, [assignableCategoryTags.length, showClearInMenu]);

  const closeMenu = useCallback(
    ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
      setIsOpen(false);
      setMenuStyle(null);

      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      closeMenu({ restoreFocus: true });
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [getMenuStyle, isOpen]);

  async function assignCategory(categoryTagId: string | null) {
    await onAssign(categoryTagId);
    closeMenu();
  }

  const menu =
    isOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="modal-panel modal-panel--flat fixed z-60 grid gap-1 p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(8,6,20,0.44)]"
            style={menuStyle}
          >
            {assignableCategoryTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[#f0c38e]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={() => void assignCategory(tag.id)}
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.colorHex }}
                />
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
            {showClearInMenu ? (
              <button
                type="button"
                aria-label={clearLabel}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={() => void assignCategory(null)}
              >
                <X aria-hidden="true" className="size-4" />
                <span className="truncate">{clearLabel}</span>
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <button
        aria-expanded={isOpen}
        aria-label={assignLabel}
        className={`inline-flex items-center justify-center rounded-md text-muted transition hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 ${
          renderTriggerContent
            ? (triggerClassName ?? '')
            : `size-9 rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e] ${
                selectedCategory ? 'text-[#fff9f2]' : ''
              } ${triggerClassName ?? ''}`
        }`}
        disabled={disabled}
        ref={triggerRef}
        style={triggerStyle}
        type="button"
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          setMenuStyle(getMenuStyle());
          setIsOpen(true);
        }}
      >
        {renderTriggerContent ? (
          renderTriggerContent({
            isOpen,
            selectedCategory: selectedCategory
              ? {
                  colorHex: selectedCategory.colorHex,
                  id: selectedCategory.id,
                  name: selectedCategory.name,
                }
              : null,
          })
        ) : (
          <>
            {selectedCategory ? (
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-white/25"
                style={{ backgroundColor: selectedCategory.colorHex }}
              />
            ) : (
              <Palette aria-hidden="true" className="size-4" />
            )}
          </>
        )}
      </button>

      {selectedCategory ? (
        <button
          aria-label={clearLabel}
          className={
            clearClassName ??
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-40'
          }
          disabled={disabled}
          type="button"
          onClick={() => {
            closeMenu();
            void onAssign(null);
          }}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}

      {menu}
    </div>
  );
}
