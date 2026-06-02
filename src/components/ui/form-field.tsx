'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Input } from './input';
import { Text } from './text';

type FormFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'id'
> & {
  className?: string;
  error?: string | null;
  id?: string;
  label: string;
};

const cardBackground =
  'color-mix(in srgb, var(--background) 25%, var(--surface) 75%)';
const fieldBackground = `color-mix(in srgb, var(--background) 55%, ${cardBackground} 45%)`;
const labelBackground = `linear-gradient(to bottom, ${cardBackground} 0 50%, ${fieldBackground} 50% 100%)`;

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  function FormField({ className = '', error, id, label, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const labelId = `${inputId}-label`;
    const errorId = error ? `${inputId}-error` : undefined;
    const isDisabled = Boolean(props.disabled);

    return (
      <div className="space-y-1.5">
        <div
          className="relative pt-2"
          style={{ backgroundColor: cardBackground }}
        >
          <label
            id={labelId}
            className={`absolute left-8 top-2 z-10 -translate-y-1/2 !cursor-text ps-2 pe-1 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.24em] ${
              error ? 'text-rose-600' : 'text-[#fff9f2]/90'
            }`}
            htmlFor={inputId}
            style={{ backgroundImage: labelBackground }}
          >
            {label}
          </label>
          <div
            className={`rounded-[0.75rem] py-2 shadow-sm ring-1 transition ${
              error
                ? 'ring-rose-500/35 focus-within:ring-2 focus-within:ring-rose-500/55 focus-within:shadow-[0_0_0_4px_rgba(244,63,94,0.08)]'
                : 'ring-2 ring-[#fff9f2]/88 focus-within:ring-2 focus-within:ring-[#fff9f2] focus-within:shadow-[0_0_0_4px_rgba(255,249,242,0.12)]'
            } ${isDisabled ? 'opacity-75' : ''}`}
            style={{ backgroundColor: fieldBackground }}
          >
            <Input
              ref={ref}
              id={inputId}
              aria-describedby={errorId}
              aria-invalid={error ? true : undefined}
              className={`h-8 w-full border-0 bg-transparent p-0 pl-6 text-base leading-8 text-foreground outline-none placeholder:text-[#fff9f2]/72 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted/60 ${className}`}
              {...props}
            />
          </div>
        </div>
        {error ? (
          <Text
            as="span"
            id={errorId}
            className="block px-4"
            size="xs"
            tone="danger"
          >
            {error}
          </Text>
        ) : null}
      </div>
    );
  },
);
