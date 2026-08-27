'use client';

import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { ButtonTone } from './button';

type ActionButtonTone = Extract<ButtonTone, 'primary' | 'secondary' | 'accent'>;

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  description?: string;
  icon?: ReactNode;
  label: string;
  tone?: ActionButtonTone;
};

const toneClassNames: Record<
  ActionButtonTone,
  {
    description: string;
    icon: string;
    wrapper: string;
    label: string;
    iconShell: string;
  }
> = {
  primary: {
    wrapper:
      'inset-ring-hairline inset-ring-[#f8d7aa]/70 bg-[#f0c38e] text-[#253241] shadow-md shadow-[#f0c38e]/18 hover:inset-ring-[#ffe0b8] hover:bg-[#f5d09f]',
    icon: 'bg-[#253241]/10 text-[#253241]',
    label: 'text-[#253241]',
    description: 'text-[#253241]/82',
    iconShell: 'bg-[#253241]/10',
  },
  secondary: {
    wrapper:
      'inset-ring-hairline inset-ring-[#fff9f2]/22 bg-[#fff9f2]/10 text-[#fff9f2] shadow-sm shadow-[#253241]/8 hover:inset-ring-[#fff9f2]/34 hover:bg-[#fff9f2]/15',
    icon: 'bg-[#fff9f2]/12 text-[#fff9f2]',
    label: 'text-[#fff9f2]',
    description: 'text-[#fff9f2]/82',
    iconShell: 'bg-[#fff9f2]/12',
  },
  accent: {
    wrapper:
      'inset-ring-hairline inset-ring-[#fff9f2]/18 bg-transparent text-[#fff9f2] shadow-none hover:inset-ring-[#fff9f2]/34 hover:bg-[#fff9f2]/8',
    icon: 'bg-[#fff9f2]/8 text-[#fff9f2]/90',
    label: 'text-[#fff9f2]/92',
    description: 'text-[#fff9f2]/76',
    iconShell: 'bg-[#fff9f2]/8',
  },
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      className = '',
      description,
      icon,
      label,
      tone = 'secondary',
      type = 'button',
      ...props
    },
    ref,
  ) {
    const descriptionId = useId();
    const toneStyles = toneClassNames[tone];
    const hasDescription = Boolean(description);

    return (
      <div
        className={`group w-full cursor-pointer overflow-hidden rounded-[0.75rem] transition-colors duration-200 focus-within:ring-2 focus-within:ring-[#f0c38e]/45 focus-within:ring-offset-2 focus-within:ring-offset-background ${toneStyles.wrapper} ${className}`}
      >
        <button
          ref={ref}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-label={label}
          className="flex h-12 w-full cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-left outline-none transition disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none"
          type={type}
          {...props}
        >
          {icon ? (
            <span
              aria-hidden="true"
              className={`grid size-9 shrink-0 place-items-center rounded-[0.625rem] text-base ${toneStyles.icon} ${toneStyles.iconShell}`}
            >
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 pr-1">
            <span
              className={`block truncate text-[0.94rem] font-semibold ${toneStyles.label}`}
            >
              {label}
            </span>
          </span>
        </button>
        {description ? (
          <p
            id={descriptionId}
            className={`action-button-description grid max-h-0 cursor-pointer select-none overflow-hidden px-3.5 text-xs leading-5 opacity-0 transition-all duration-200 ease-out group-hover:max-h-14 group-hover:pb-3 group-hover:opacity-100 ${toneStyles.description}`}
          >
            <span className="block pt-0.5">{description}</span>
          </p>
        ) : null}
      </div>
    );
  },
);
