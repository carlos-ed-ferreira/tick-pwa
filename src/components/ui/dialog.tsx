'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { IconButton } from './icon-button';

export type DialogSize = 'full' | 'sheet';

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const panelSizeClassNames: Record<DialogSize, string> = {
  full: 'h-dvh sm:h-[min(92vh,900px)] sm:max-w-6xl',
  sheet: 'max-h-[85dvh] sm:h-auto sm:max-w-md',
};

const openDialogCloseHandlers: Array<() => void> = [];

export function Dialog({
  children,
  closeLabel = 'Close',
  panelClassName = '',
  size = 'full',
  title,
  open,
  onClose,
}: {
  children: ReactNode;
  closeLabel?: string;
  panelClassName?: string;
  size?: DialogSize;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousActiveElementRef.current = document.activeElement;

    const frameId = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    const closeHandler = () => closeRef.current();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        openDialogCloseHandlers[openDialogCloseHandlers.length - 1] ===
          closeHandler
      ) {
        closeHandler();
      }
    }

    openDialogCloseHandlers.push(closeHandler);
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      openDialogCloseHandlers.splice(
        openDialogCloseHandlers.indexOf(closeHandler),
        1,
      );

      if (openDialogCloseHandlers.length === 0) {
        document.body.style.overflow = '';
      }

      if (previousActiveElementRef.current instanceof HTMLElement) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !panelRef.current) {
      return;
    }

    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter(
      (element) => element.offsetParent !== null || element.tabIndex >= 0,
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[#050a0e]/70 backdrop-blur-xl sm:items-center sm:justify-center sm:p-6"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-surface flex w-full flex-col overflow-hidden border-0 outline-none after:hidden ${panelSizeClassNames[size]} ${panelClassName}`}
        onKeyDown={handlePanelKeyDown}
      >
        <div className="modal-header flex items-center justify-between border-0 px-4 py-3 sm:px-5">
          <h2
            className="truncate text-lg font-semibold tracking-tight text-[#fff9f2]"
            id={titleId}
          >
            {title}
          </h2>
          <IconButton
            aria-label={closeLabel}
            size="compact"
            className="rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        {size === 'sheet' ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );

  return typeof document === 'undefined'
    ? dialog
    : createPortal(dialog, document.body);
}
