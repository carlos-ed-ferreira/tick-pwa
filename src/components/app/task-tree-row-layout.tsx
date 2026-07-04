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
    paddingLeft: `${depth * 14}px`,
    backgroundColor: isSelected
      ? 'rgba(240, 195, 142, 0.12)'
      : categoryColorHex
        ? toAlphaColor(categoryColorHex, 0.12)
        : undefined,
    boxShadow: isPriority
      ? 'inset 4px 0 0 0 rgba(240, 195, 142, 1)'
      : undefined,
  };

  return (
    <div
      className="group flex min-w-0 items-center gap-1 rounded-xl border border-transparent px-1 py-1 transition hover:border-white/[0.08] hover:bg-white/[0.055]"
      style={style}
    >
      {children}
    </div>
  );
}
