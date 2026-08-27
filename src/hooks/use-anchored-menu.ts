'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const menuOffset = 8;
const viewportPadding = 16;

export function useAnchoredMenu<TTrigger extends HTMLElement>({
  estimateMenuHeight,
  preferredWidth,
}: {
  estimateMenuHeight: () => number;
  preferredWidth: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<TTrigger | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const getMenuStyle = useCallback((): CSSProperties | null => {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === 'undefined') {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(
      preferredWidth,
      Math.max(0, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.left),
      window.innerWidth - viewportPadding - width,
    );
    const menuHeight = Math.min(
      estimateMenuHeight(),
      window.innerHeight - viewportPadding * 2,
    );
    const shouldOpenUpward =
      triggerRect.bottom + menuOffset + menuHeight >
        window.innerHeight - viewportPadding &&
      triggerRect.top > window.innerHeight - triggerRect.bottom;

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
  }, [estimateMenuHeight, preferredWidth]);

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

  const openMenu = useCallback(() => {
    setMenuStyle(getMenuStyle());
    setIsOpen(true);
  }, [getMenuStyle]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function isOutside(target: Node) {
      return (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      );
    }

    function handlePointerDown(event: PointerEvent) {
      if (isOutside(event.target as Node)) {
        closeMenu();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (isOutside(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      closeMenu({ restoreFocus: true });
    }

    function updateMenuStyle() {
      const nextMenuStyle = getMenuStyle();

      if (nextMenuStyle) {
        setMenuStyle(nextMenuStyle);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuStyle);
    window.addEventListener('scroll', updateMenuStyle, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuStyle);
      window.removeEventListener('scroll', updateMenuStyle, true);
    };
  }, [closeMenu, getMenuStyle, isOpen]);

  return {
    closeMenu,
    containerRef,
    isOpen,
    menuRef,
    menuStyle,
    openMenu,
    triggerRef,
  };
}
