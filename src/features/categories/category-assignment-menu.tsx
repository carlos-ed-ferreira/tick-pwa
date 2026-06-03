'use client';

import { Palette, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui';
import type { CategoryTagSurface } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { useCategoryTags } from './use-category-tags';

const menuOffset = 8;
const viewportPadding = 16;

export function CategoryAssignmentMenu({
  assignLabel,
  clearLabel,
  disabled,
  selectedCategoryTagId,
  surface,
  onAssign,
}: {
  assignLabel: string;
  clearLabel: string;
  disabled?: boolean;
  selectedCategoryTagId: string | null;
  surface: CategoryTagSurface;
  onAssign: (categoryTagId: string | null) => Promise<void> | void;
}) {
  const { scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, surface);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<
    | {
        top: number;
        right: number;
      }
    | {
        bottom: number;
        right: number;
      }
    | null
  >(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedCategory = categoryTags.find(
    (tag) => tag.id === selectedCategoryTagId,
  );

  const getMenuStyle = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === 'undefined') {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(
      56 + categoryTags.length * 40,
      window.innerHeight - viewportPadding * 2,
    );
    const shouldOpenUpward =
      triggerRect.bottom + menuOffset + estimatedMenuHeight >
        window.innerHeight - viewportPadding &&
      triggerRect.top > window.innerHeight - triggerRect.bottom;
    const right = Math.max(
      viewportPadding,
      window.innerWidth - triggerRect.right,
    );

    if (shouldOpenUpward) {
      return {
        bottom: Math.max(
          viewportPadding,
          window.innerHeight - triggerRect.top + menuOffset,
        ),
        right,
      };
    }

    return {
      top: Math.max(viewportPadding, triggerRect.bottom + menuOffset),
      right,
    };
  }, [categoryTags.length]);

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
            className="modal-panel fixed z-60 grid max-h-[min(20rem,calc(100vh-2rem))] min-w-48 gap-1 overflow-y-auto p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(8,6,20,0.44)]"
            style={menuStyle}
          >
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[#bdb4d4] transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onClick={() => void assignCategory(null)}
            >
              <X aria-hidden="true" className="size-4" />
              {clearLabel}
            </button>
            {categoryTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[#f0c38e]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={() => void assignCategory(tag.id)}
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ backgroundColor: tag.colorHex }}
                />
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        aria-expanded={isOpen}
        aria-label={assignLabel}
        className={`rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e] ${
          selectedCategory ? 'text-[#fff9f2]' : ''
        }`}
        disabled={disabled}
        ref={triggerRef}
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          setMenuStyle(getMenuStyle());
          setIsOpen(true);
        }}
      >
        {selectedCategory ? (
          <span
            aria-hidden="true"
            className="size-4 rounded-full border border-white/25"
            style={{ backgroundColor: selectedCategory.colorHex }}
          />
        ) : (
          <Palette aria-hidden="true" className="size-4" />
        )}
      </IconButton>

      {menu}
    </div>
  );
}
