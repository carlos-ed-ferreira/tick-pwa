'use client';

import {
  compactActivePillTabClassName,
  compactPillTabClassName,
  compactPillTabListClassName,
} from '@/components/ui';

export function RecurringPillGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: Value }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${compactPillTabListClassName} w-fit max-w-full shrink-0 overflow-x-auto`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`${
            value === option.value
              ? compactActivePillTabClassName
              : compactPillTabClassName
          } shrink-0 whitespace-nowrap`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
