'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { IconButton } from './icon-button';

export function Dialog({
  children,
  closeLabel = 'Close',
  panelClassName = '',
  title,
  open,
  onClose,
}: {
  children: ReactNode;
  closeLabel?: string;
  panelClassName?: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousActiveElementRef.current = document.activeElement;

    const frameId = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';

      if (previousActiveElementRef.current instanceof HTMLElement) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[#090716]/70 backdrop-blur-xl sm:items-center sm:justify-center sm:p-6"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`modal-surface flex h-dvh w-full flex-col overflow-hidden border-0 outline-none after:hidden sm:h-[min(92vh,900px)] sm:max-w-6xl ${panelClassName}`}
      >
        <div className="modal-header flex items-center justify-between border-0 px-4 py-3 sm:px-5">
          <h2 className="truncate text-lg font-semibold tracking-tight text-[#fff9f2]">
            {title}
          </h2>
          <IconButton
            aria-label={closeLabel}
            size="compact"
            className="rounded-full border border-white/10 bg-white/5 text-[#d8d0e8] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );

  return typeof document === 'undefined'
    ? dialog
    : createPortal(dialog, document.body);
}
