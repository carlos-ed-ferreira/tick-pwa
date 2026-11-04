import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui';
import {
  headerControlAccentFillClassName,
  headerControlDangerFillClassName,
  headerControlNeutralFillClassName,
  headerRoundControlClassName,
} from './header-control';

const fillClassNames = {
  accent: headerControlAccentFillClassName,
  danger: headerControlDangerFillClassName,
  neutral: headerControlNeutralFillClassName,
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
        className={`${headerRoundControlClassName} ${fillClassNames[fill]}`}
        type={type}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
