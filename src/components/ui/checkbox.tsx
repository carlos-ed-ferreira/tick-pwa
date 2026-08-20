import type { InputHTMLAttributes } from 'react';

const checkboxClassName =
  'tick-checkbox shrink-0 appearance-none rounded-lg bg-accent-soft shadow-none inset-ring-hairline inset-ring-(--checkbox-edge)';

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
      className={`${checkboxClassName} size-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  );
}

export function CheckboxIndicator({
  checked = false,
  className = '',
  indeterminate = false,
  size = 'default',
}: {
  checked?: boolean;
  className?: string;
  indeterminate?: boolean;
  size?: 'compact' | 'default';
}) {
  return (
    <span
      aria-hidden="true"
      data-checked={checked && !indeterminate ? 'true' : undefined}
      data-ignored={indeterminate ? 'true' : undefined}
      className={`${checkboxClassName} ${
        size === 'compact' ? 'size-4' : 'size-5'
      } ${className}`}
    />
  );
}
