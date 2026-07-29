import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ModalActionButtonTone = 'neutral' | 'accent' | 'danger';

const toneClassNames: Record<ModalActionButtonTone, string> = {
  neutral:
    'border border-white/10 bg-white/[0.055] text-[#d8d0e8] hover:border-white/20 hover:bg-white/[0.1] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]',
  accent:
    'border border-[#f8d7aa]/70 bg-[#f0c38e] text-[#312c51] shadow-[#f0c38e]/18 hover:border-[#ffe0b8] hover:bg-[#f5d09f] focus-visible:outline-[#f0c38e]',
  danger:
    'border border-rose-300/20 bg-rose-500/90 text-rose-50 shadow-rose-500/20 hover:border-rose-200/30 hover:bg-rose-500 focus-visible:outline-rose-200',
};

export function ModalActionButton({
  children,
  className = '',
  tone = 'neutral',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: ModalActionButtonTone;
}) {
  return (
    <button
      type={type}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${toneClassNames[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
