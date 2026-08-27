import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonTone =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'subtle'
  | 'danger';

export const buttonToneClassNames: Record<ButtonTone, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/95 focus-visible:outline-primary',
  secondary:
    'bg-secondary text-primary-foreground hover:bg-secondary/95 focus-visible:outline-secondary',
  accent:
    'bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:outline-accent',
  subtle:
    'inset-ring-hairline inset-ring-border/70 bg-background/45 text-foreground hover:bg-background/72 focus-visible:outline-foreground',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600',
};

export function Button({
  children,
  className = '',
  type = 'button',
  tone = 'secondary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: ButtonTone;
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] px-4 text-sm font-medium shadow-none transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonToneClassNames[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
