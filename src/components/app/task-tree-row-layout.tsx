import type { CSSProperties, DragEventHandler, ReactNode } from 'react';
import type { TreeMovePlacement } from './move-tree-item-to-target';
import { toAlphaColor } from '@/lib/color';

export function TaskTreeRowLayout({
  categoryColorHex,
  children,
  depth,
  dropPosition,
  isDragging = false,
  isPriority = false,
  isSelected = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  categoryColorHex?: string;
  children: ReactNode;
  depth: number;
  dropPosition?: TreeMovePlacement | null;
  isDragging?: boolean;
  isPriority?: boolean;
  isSelected?: boolean;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
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
      className={`group relative flex min-h-11 min-w-0 items-center gap-1 rounded-lg border border-transparent p-0 transition hover:border-white/[0.08] hover:bg-white/[0.055] ${
        isDragging ? 'opacity-45' : ''
      } ${
        dropPosition === 'child'
          ? 'border-[#f0c38e]/50 bg-[#f0c38e]/[0.12] shadow-[inset_0_0_0_1px_rgba(240,195,142,0.14)]'
          : dropPosition
            ? 'bg-[#f0c38e]/[0.055]'
            : ''
      } ${dropPosition ? 'z-10' : ''}`}
      data-tree-row
      data-drop-position={dropPosition ?? undefined}
      style={style}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dropPosition === 'before' || dropPosition === 'after' ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-20 right-2 left-2 h-0.5 rounded-full bg-[#f0c38e] shadow-[0_0_12px_rgba(240,195,142,0.72)] ${
            dropPosition === 'before' ? '-top-[3px]' : '-bottom-[3px]'
          }`}
        />
      ) : null}
      {dropPosition === 'child' ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute z-20 top-1/2 left-1 h-5 w-1 -translate-y-1/2 rounded-full bg-[#f0c38e] shadow-[0_0_10px_rgba(240,195,142,0.65)]"
        />
      ) : null}
      {children}
    </div>
  );
}
