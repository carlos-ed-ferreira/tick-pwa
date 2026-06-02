import type { InputHTMLAttributes } from 'react';

export function Checkbox({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={`size-5 shrink-0 rounded border border-border accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${className}`}
      {...props}
    />
  );
}
