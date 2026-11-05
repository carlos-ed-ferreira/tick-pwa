'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Input } from './input';
import { Text } from './text';

const fieldTextClassName =
  'w-full bg-transparent text-foreground outline-none placeholder:text-[#fff9f2]/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted/60';

const labelTypographyClassName =
  'px-1 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.24em]';

function LabeledField({
  children,
  className = '',
  endAdornment,
  error,
  errorId,
  inputId,
  isDisabled,
  label,
}: {
  children: ReactNode;
  className?: string;
  endAdornment?: ReactNode;
  error?: string | null;
  errorId?: string;
  inputId: string;
  isDisabled: boolean;
  label: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 pt-2 ${className}`}>
      <div
        className={`group relative flex flex-1 items-center gap-1 rounded-[0.75rem] bg-background/40 ${
          endAdornment ? 'pr-1.5' : ''
        } ${isDisabled ? 'opacity-75' : ''}`}
      >
        <label
          className={`absolute left-5 top-0 z-10 -translate-y-1/2 cursor-text ${labelTypographyClassName} ${
            error ? 'text-rose-300' : 'text-[#fff9f2]/90'
          }`}
          htmlFor={inputId}
        >
          {label}
        </label>
        {children}
        {endAdornment}
        <fieldset
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 -top-2 bottom-0 m-0 min-w-0 rounded-[0.75rem] border px-5 transition ${
            error
              ? 'border-rose-400/55'
              : 'border-white/18 group-hover:border-white/28 group-focus-within:border-[#f0c38e]/70'
          }`}
        >
          <legend
            className={`invisible whitespace-nowrap ${labelTypographyClassName}`}
          >
            <span
              className="before:content-[attr(data-label)]"
              data-label={label}
            />
          </legend>
        </fieldset>
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
}

type FieldProps = {
  error?: string | null;
  id?: string;
  label: string;
};

export const FormField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> &
    FieldProps & { endAdornment?: ReactNode }
>(function FormField(
  { className = '', endAdornment, error, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <LabeledField
      endAdornment={endAdornment}
      error={error}
      errorId={errorId}
      inputId={inputId}
      isDisabled={Boolean(props.disabled)}
      label={label}
    >
      <Input
        ref={ref}
        id={inputId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`h-11 pl-6 text-base ${endAdornment ? 'pr-2' : 'pr-4'} ${fieldTextClassName} ${className}`}
        {...props}
      />
    </LabeledField>
  );
});

export const FormTextareaField = forwardRef<
  HTMLTextAreaElement,
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> &
    FieldProps & { fieldClassName?: string; monospace?: boolean }
>(function FormTextareaField(
  {
    autoCapitalize = 'none',
    autoCorrect = 'off',
    className = '',
    error,
    fieldClassName = '',
    id,
    label,
    monospace = false,
    spellCheck = false,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <LabeledField
      className={fieldClassName}
      error={error}
      errorId={errorId}
      inputId={inputId}
      isDisabled={Boolean(props.disabled)}
      label={label}
    >
      <textarea
        ref={ref}
        id={inputId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        className={`h-full resize-none self-stretch px-6 py-4 ${
          monospace
            ? 'font-mono text-xs leading-5 touch:text-base'
            : 'text-base'
        } ${fieldTextClassName} ${className}`}
        {...props}
      />
    </LabeledField>
  );
});
