'use client';

import { X } from 'lucide-react';
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-foreground/20 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`card-surface-strong flex h-dvh w-full flex-col overflow-hidden outline-none sm:h-[min(92vh,900px)] sm:max-w-6xl ${panelClassName}`}
      >
        <div className="flex items-center justify-between bg-background/35 px-4 py-3 sm:px-5">
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
