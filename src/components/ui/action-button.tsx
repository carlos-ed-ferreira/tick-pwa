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
      'border border-[#312c51]/15 bg-[#312c51] text-[#fff9f2] shadow-sm shadow-[#312c51]/12 hover:border-[#312c51]/20 hover:bg-[#3b3560]',
    icon: 'bg-[#fff9f2]/12 text-[#fff9f2]',
    label: 'text-[#fff9f2]',
    description: 'text-[#fff9f2]/72',
    iconShell: 'bg-[#fff9f2]/12',
  },
  secondary: {
    wrapper:
      'border border-[#48426d]/16 bg-[#48426d] text-[#fff9f2] shadow-sm shadow-[#312c51]/10 hover:border-[#48426d]/24 hover:bg-[#544d7d]',
    icon: 'bg-[#fff9f2]/12 text-[#fff9f2]',
    label: 'text-[#fff9f2]',
    description: 'text-[#fff9f2]/70',
    iconShell: 'bg-[#fff9f2]/12',
  },
  accent: {
    wrapper:
      'border border-[#f1aa9b]/35 bg-[#f1aa9b] text-[#312c51] shadow-sm shadow-[#312c51]/8 hover:border-[#f1aa9b]/45 hover:bg-[#f3b5a8]',
    icon: 'bg-[#312c51]/10 text-[#312c51]',
    label: 'text-[#312c51]',
    description: 'text-[#312c51]/68',
    iconShell: 'bg-[#312c51]/10',
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
        className={`group w-full cursor-pointer overflow-hidden rounded-2xl transition-colors duration-200 focus-within:ring-2 focus-within:ring-[#f0c38e]/45 focus-within:ring-offset-2 focus-within:ring-offset-background ${toneStyles.wrapper} ${className}`}
      >
        <button
          ref={ref}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-label={label}
          className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left outline-none transition disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none"
          type={type}
          {...props}
        >
          {icon ? (
            <span
              aria-hidden="true"
              className={`grid size-9 shrink-0 place-items-center rounded-xl text-base ${toneStyles.icon} ${toneStyles.iconShell}`}
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
            className={`grid max-h-0 cursor-pointer select-none overflow-hidden px-3.5 text-xs leading-5 opacity-0 transition-all duration-200 ease-out group-hover:max-h-14 group-hover:pb-3 group-hover:opacity-100 ${toneStyles.description}`}
          >
            <span className="block pt-0.5">{description}</span>
          </p>
        ) : null}
      </div>
    );
  },
);
