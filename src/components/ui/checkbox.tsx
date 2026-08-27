import type { InputHTMLAttributes, Ref } from 'react';

const checkboxClassName =
  'tick-checkbox shrink-0 appearance-none rounded-lg bg-accent-soft shadow-none inset-ring-hairline inset-ring-(--checkbox-edge)';

function markLevelAttribute({
  level,
  levels,
}: {
  level: number;
  levels: number;
}): string | undefined {
  return levels > 1 && level > 0 ? String(level) : undefined;
}

export function Checkbox({
  className = '',
  indeterminate = false,
  level = 0,
  levels = 1,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  indeterminate?: boolean;
  level?: number;
  levels?: number;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      type="checkbox"
      aria-checked={indeterminate ? 'mixed' : props.checked}
      data-ignored={indeterminate ? 'true' : undefined}
      data-mark-level={
        indeterminate ? undefined : markLevelAttribute({ level, levels })
      }
      className={`${checkboxClassName} size-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  );
}

export function CheckboxIndicator({
  checked = false,
  className = '',
  indeterminate = false,
  level = 0,
  levels = 1,
  size = 'default',
}: {
  checked?: boolean;
  className?: string;
  indeterminate?: boolean;
  level?: number;
  levels?: number;
  size?: 'compact' | 'default';
}) {
  return (
    <span
      aria-hidden="true"
      data-checked={checked && !indeterminate ? 'true' : undefined}
      data-ignored={indeterminate ? 'true' : undefined}
      data-mark-level={
        indeterminate ? undefined : markLevelAttribute({ level, levels })
      }
      className={`${checkboxClassName} ${
        size === 'compact' ? 'size-4' : 'size-5'
      } ${className}`}
    />
  );
}
