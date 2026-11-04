import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ModalActionButtonTone =
  | 'neutral'
  | 'secondary'
  | 'accent'
  | 'danger';

const toneClassNames: Record<ModalActionButtonTone, string> = {
  neutral:
    'bg-white/8 text-[#f8f3ea] shadow-[#253241]/10 hover:bg-white/12 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]',
  secondary:
    'bg-[#5f7388]/40 text-[#fff9f2] shadow-[#253241]/10 hover:bg-[#657f9b]/52 focus-visible:outline-[#b3c3d7]',
  accent:
    'bg-[#f0c38e] text-[#253241] shadow-[#f0c38e]/18 hover:bg-[#f5d09f] focus-visible:outline-[#f0c38e]',
  danger:
    'bg-rose-500/90 text-rose-50 shadow-rose-500/20 hover:bg-rose-500 focus-visible:outline-rose-200',
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
      className={`touch-target inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${toneClassNames[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
