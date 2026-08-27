'use client';

import { Palette, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, type CSSProperties, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui';
import { useAnchoredMenu } from '@/hooks/use-anchored-menu';
import type { CategoryTagSurface } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { useCategoryTags } from './use-category-tags';

const defaultMenuPreferredWidth = 248;

export function CategoryAssignmentMenu({
  assignLabel,
  clearClassName,
  clearLabel,
  disabled,
  menuPreferredWidth = defaultMenuPreferredWidth,
  renderClearContent,
  renderTriggerContent,
  selectedCategoryTagId,
  showClearButton = true,
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
  menuPreferredWidth?: number;
  renderClearContent?: () => ReactNode;
  renderTriggerContent?: (args: {
    isOpen: boolean;
    selectedCategory: {
      colorHex: string;
      id: string;
      name: string;
    } | null;
  }) => ReactNode;
  selectedCategoryTagId: string | null;
  showClearButton?: boolean;
  showClearInMenu?: boolean;
  surface: CategoryTagSurface;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  onAssign: (categoryTagId: string | null) => Promise<void> | void;
}) {
  const { scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, surface);
  const selectedCategory = categoryTags.find(
    (tag) => tag.id === selectedCategoryTagId,
  );
  const assignableCategoryTags = categoryTags.filter((tag) => !tag.useOwnName);
  const hasMenuActions = assignableCategoryTags.length > 0 || showClearInMenu;
  const isTriggerDisabled = disabled || !hasMenuActions;
  const estimateMenuHeight = useCallback(
    () => 16 + (assignableCategoryTags.length + (showClearInMenu ? 1 : 0)) * 40,
    [assignableCategoryTags.length, showClearInMenu],
  );
  const {
    closeMenu,
    containerRef,
    isOpen,
    menuRef,
    menuStyle,
    openMenu,
    triggerRef,
  } = useAnchoredMenu<HTMLButtonElement>({
    estimateMenuHeight,
    preferredWidth: menuPreferredWidth,
  });

  async function assignCategory(categoryTagId: string | null) {
    await onAssign(categoryTagId);
    closeMenu();
  }

  const menu =
    isOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="modal-panel modal-panel--flat fixed z-60 grid gap-1 p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(5,8,13,0.44)]"
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
      <Tooltip content={assignLabel}>
        <button
          aria-expanded={isOpen}
          aria-label={assignLabel}
          className={
            renderTriggerContent
              ? (triggerClassName ?? '')
              : `inline-flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-40 ${
                  selectedCategory ? 'text-[#fff9f2]' : ''
                } ${triggerClassName ?? ''}`
          }
          disabled={isTriggerDisabled}
          ref={triggerRef}
          style={triggerStyle}
          type="button"
          onClick={() => {
            if (isOpen) {
              closeMenu();
              return;
            }

            openMenu();
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
                  className="size-4 rounded-full inset-ring-hairline inset-ring-white/25"
                  style={{ backgroundColor: selectedCategory.colorHex }}
                />
              ) : (
                <Palette aria-hidden="true" className="size-4" />
              )}
            </>
          )}
        </button>
      </Tooltip>

      {selectedCategory && showClearButton ? (
        <Tooltip content={clearLabel}>
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
            {renderClearContent ? (
              renderClearContent()
            ) : (
              <X aria-hidden="true" className="size-4" />
            )}
          </button>
        </Tooltip>
      ) : null}

      {menu}
    </div>
  );
}
