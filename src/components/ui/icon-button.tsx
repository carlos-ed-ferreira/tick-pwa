import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './tooltip';

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    size?: 'compact' | 'default';
    tooltip?: ReactNode;
  }
>(function IconButton(
  {
    'aria-label': ariaLabel,
    children,
    className = '',
    size = 'default',
    title,
    tooltip,
    type = 'button',
    ...props
  },
  ref,
) {
  const tooltipContent =
    tooltip ?? title ?? (typeof ariaLabel === 'string' ? ariaLabel : null);
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      className={`touch-target inline-flex ${size === 'compact' ? 'size-8' : 'size-9'} shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );

  return tooltipContent ? (
    <Tooltip content={tooltipContent}>{button}</Tooltip>
  ) : (
    button
  );
});
