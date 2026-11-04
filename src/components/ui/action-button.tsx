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
  { description: string; icon: string; label: string; wrapper: string }
> = {
  primary: {
    wrapper:
      'bg-[#f0c38e] text-[#253241] shadow-md shadow-[#f0c38e]/18 hover:bg-[#f5d09f]',
    icon: 'text-[#253241]',
    label: 'text-[#253241]',
    description: 'text-[#253241]/82',
  },
  secondary: {
    wrapper:
      'bg-white/8 text-[#fff9f2] shadow-sm shadow-[#253241]/10 hover:bg-white/12',
    icon: 'text-[#fff9f2]',
    label: 'text-[#fff9f2]',
    description: 'text-[#fff9f2]/82',
  },
  accent: {
    wrapper:
      'bg-white/5 text-[#fff9f2] shadow-sm shadow-[#253241]/10 hover:bg-white/10',
    icon: 'text-[#fff9f2]/90',
    label: 'text-[#fff9f2]/92',
    description: 'text-[#fff9f2]/76',
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
    const interactionClassName = props.disabled
      ? 'cursor-not-allowed opacity-60'
      : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0';

    return (
      <div
        className={`group w-full overflow-hidden rounded-3xl transition duration-200 ${interactionClassName} focus-within:ring-2 focus-within:ring-[#f0c38e]/45 focus-within:ring-offset-2 focus-within:ring-offset-background ${toneStyles.wrapper} ${className}`}
      >
        <button
          ref={ref}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-label={label}
          className="flex h-12 w-full cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-left outline-none transition disabled:cursor-not-allowed focus-visible:outline-none"
          type={type}
          {...props}
        >
          {icon ? (
            <span
              aria-hidden="true"
              className={`grid size-6 shrink-0 place-items-center text-base ${toneStyles.icon}`}
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
            className={`action-button-description grid max-h-0 cursor-pointer select-none overflow-hidden pr-3.5 ${icon ? 'pl-12' : 'pl-3.5'} text-xs leading-5 opacity-0 transition-all duration-200 ease-out ${props.disabled ? '' : 'group-hover:max-h-14 group-hover:pb-3 group-hover:opacity-100'} ${toneStyles.description}`}
          >
            <span className="block pt-0.5">{description}</span>
          </p>
        ) : null}
      </div>
    );
  },
);
