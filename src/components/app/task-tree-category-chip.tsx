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
      className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium leading-none"
      style={{
        borderColor: colorHex,
        backgroundColor: toAlphaColor(colorHex, 0.18),
        color: colorHex,
      }}
    >
      {name}
    </span>
  );
}
