import type { CSSProperties } from 'react';
import { Tooltip } from '@/components/ui';
import { toAlphaColor } from '@/lib/color';

export function TaskTreeCategoryChip({
  colorHex,
  name,
}: {
  colorHex: string;
  name: string;
}) {
  return (
    <Tooltip content={name} whenTruncated className="min-w-0 max-w-full">
      <span
        tabIndex={0}
        className="shrink-0 truncate rounded-full touch:text-foreground! inset-ring-hairline inset-ring-(--chip-edge) px-2 py-1 text-[11px] font-medium leading-none"
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
    </Tooltip>
  );
}
