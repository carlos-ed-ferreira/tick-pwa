import type { InputHTMLAttributes } from 'react';

export function Checkbox({
  className = '',
  indeterminate = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  indeterminate?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-checked={indeterminate ? 'mixed' : props.checked}
      data-ignored={indeterminate ? 'true' : undefined}
      className={`tick-checkbox size-5 shrink-0 appearance-none rounded-lg bg-accent-soft shadow-none inset-ring-hairline inset-ring-(--checkbox-edge) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  );
}
