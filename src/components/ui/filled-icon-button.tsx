import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './tooltip';
import {
  filledControlAccentClassName,
  filledControlDangerClassName,
  filledControlNeutralClassName,
  filledMediumRoundControlClassName,
} from './filled-control';

const fillClassNames = {
  accent: filledControlAccentClassName,
  danger: filledControlDangerClassName,
  neutral: filledControlNeutralClassName,
} as const;

export const FilledIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    fill?: keyof typeof fillClassNames;
    tooltip?: ReactNode;
  }
>(function FilledIconButton(
  {
    'aria-label': ariaLabel,
    children,
    fill = 'neutral',
    title,
    tooltip,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <Tooltip content={tooltip ?? title ?? ariaLabel}>
      <button
        ref={ref}
        aria-label={ariaLabel}
        className={`${filledMediumRoundControlClassName} ${fillClassNames[fill]}`}
        type={type}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
