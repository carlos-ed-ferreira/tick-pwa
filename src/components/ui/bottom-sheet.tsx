'use client';

import type { ReactNode } from 'react';
import { Dialog } from './dialog';

export type BottomSheetActionTone = 'neutral' | 'danger';

const actionToneClassNames: Record<BottomSheetActionTone, string> = {
  neutral: 'text-[#e5ebf3] hover:bg-white/[0.08] hover:text-[#fff9f2]',
  danger: 'text-rose-200 hover:bg-rose-400/[0.12] hover:text-rose-100',
};

export function BottomSheet({
  children,
  closeLabel,
  open,
  title,
  onClose,
}: {
  children: ReactNode;
  closeLabel: string;
  open: boolean;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      closeLabel={closeLabel}
      open={open}
      size="sheet"
      title={title}
      onClose={onClose}
    >
      <div className="app-safe-padding flex flex-col gap-4 px-3 pt-2 pb-4 [--app-safe-padding-block-end:1rem]">
        {children}
      </div>
    </Dialog>
  );
}

export function BottomSheetSection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1" role="group">
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8fa0b3]">
        {label}
      </p>
      {children}
    </section>
  );
}

export function BottomSheetAction({
  ariaLabel,
  children,
  disabled = false,
  icon,
  tone = 'neutral',
  onSelect,
}: {
  ariaLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  tone?: BottomSheetActionTone;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`touch-target flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-40 ${actionToneClassNames[tone]}`}
      disabled={disabled}
      onClick={onSelect}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
