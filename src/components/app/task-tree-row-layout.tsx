import type { CSSProperties, ReactNode } from 'react';
import { toAlphaColor } from '@/lib/color';

export function TaskTreeRowLayout({
  categoryColorHex,
  children,
  depth,
  isPriority = false,
  isSelected = false,
}: {
  categoryColorHex?: string;
  children: ReactNode;
  depth: number;
  isPriority?: boolean;
  isSelected?: boolean;
}) {
  const style: CSSProperties = {
    paddingLeft: `min(${depth * 16}px, 56px)`,
    backgroundColor: isSelected
      ? 'color-mix(in srgb, var(--color-foreground) 8%, transparent)'
      : categoryColorHex
        ? toAlphaColor(categoryColorHex, 0.12)
        : undefined,
    boxShadow: isPriority
      ? 'inset 3px 0 0 0 rgba(245, 158, 11, 0.9)'
      : undefined,
  };

  return (
    <div
      className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-1 transition hover:bg-surface"
      style={style}
    >
      {children}
    </div>
  );
}
