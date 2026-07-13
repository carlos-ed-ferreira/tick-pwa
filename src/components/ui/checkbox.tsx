import type { InputHTMLAttributes } from 'react';

export function Checkbox({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={`tick-checkbox size-5 shrink-0 appearance-none rounded-lg border border-border bg-accent-soft shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  );
}
