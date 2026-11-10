'use client';

import type { ReactNode } from 'react';

export function RecurringTogglePill({
  active,
  children,
  disabled = false,
  label,
  onToggle,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      className={`touch-target inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-3.5 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-[#f0c38e] text-[#253241]'
          : 'bg-white/8 text-[#aebac8] hover:bg-white/12 hover:text-[#fff9f2]'
      }`}
      onClick={onToggle}
    >
      {children}
      {label}
    </button>
  );
}
