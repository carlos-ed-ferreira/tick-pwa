import type { CSSProperties } from 'react';
import { toAlphaColor } from '@/lib/color';

export function TaskTreeCategoryChip({
  colorHex,
  name,
}: {
  colorHex: string;
  name: string;
}) {
  return (
    <span
      className="shrink-0 rounded-full inset-ring-hairline inset-ring-(--chip-edge) px-2 py-1 text-[11px] font-medium leading-none"
      style={
        {
          '--chip-edge': colorHex,
          backgroundColor: toAlphaColor(colorHex, 0.18),
          color: colorHex,
        } as CSSProperties
      }
    >
      {name}
    </span>
  );
}
