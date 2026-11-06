'use client';

import { DashedRing, Tooltip } from '@/components/ui';
import { canUseOwnName } from '@/features/categories';
import { createCategoryTag, updateCategoryTag } from '@/lib/db';
import type { AppScope, CategoryTag, CategoryTagSurface } from '@/lib/domain';
import { useAppContext } from '@/providers';

export function CategoryAccent({
  category,
  position = 'dot',
  size = 'lg',
}: {
  category?: CategoryTag | null;
  position?: 'dot' | 'top' | 'vertical';
  size?: 'sm' | 'lg';
}) {
  if (!category) {
    return null;
  }

  if (position === 'vertical') {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow: `inset 4px 0 0 0 ${category.colorHex}`,
        }}
      />
    );
  }

  if (position === 'top') {
    return (
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: category.colorHex }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 p-1 shadow-sm shadow-[#253241]/10 ${size === 'sm' ? 'size-6' : 'size-8'}`}
    >
      <span
        className="block size-full rounded-full inset-ring-hairline inset-ring-white/30 shadow-[0_6px_14px_rgba(5,8,13,0.24)]"
        style={{ backgroundColor: category.colorHex }}
      />
    </span>
  );
}

export async function applyOwnColorCategory({
  colorHex,
  onAssign,
  scope,
  selectedCategory,
  surface,
}: {
  colorHex: string;
  onAssign: (categoryTagId: string) => Promise<void> | void;
  scope: AppScope;
  selectedCategory: CategoryTag | null;
  surface: CategoryTagSurface;
}) {
  if (selectedCategory?.useOwnName) {
    await updateCategoryTag({
      scope,
      categoryTagId: selectedCategory.id,
      colorHex,
    });
    return;
  }

  const createdTag = await createCategoryTag({
    scope,
    surface,
    name: '',
    colorHex,
    useOwnName: true,
  });

  await onAssign(createdTag.id);
}

export function CategoryColorButton({
  onAssign,
  scope,
  selectedCategory,
  surface,
}: {
  onAssign: (categoryTagId: string) => Promise<void> | void;
  scope: AppScope | null;
  selectedCategory: CategoryTag | null;
  surface: CategoryTagSurface;
}) {
  const { dictionary } = useAppContext();

  if (!canUseOwnName(surface)) {
    return null;
  }

  const ownColorHex = selectedCategory?.useOwnName
    ? selectedCategory.colorHex
    : null;
  const colorLabel =
    surface === 'goal_group'
      ? dictionary.goals.assignGroupColor
      : dictionary.goals.assignGoalColor;

  async function handleColorChange(colorHex: string) {
    if (!scope) {
      return;
    }

    await applyOwnColorCategory({
      colorHex,
      onAssign,
      scope,
      selectedCategory,
      surface,
    });
  }

  return (
    <Tooltip content={colorLabel}>
      <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/8 shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:bg-white/12 hover:shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f7d9b0]">
        <input
          aria-label={colorLabel}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="color"
          value={ownColorHex ?? '#71717a'}
          onChange={(event) => void handleColorChange(event.target.value)}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none relative block size-5 rounded-full shadow-[0_6px_14px_rgba(5,8,13,0.24)] ${
            ownColorHex
              ? 'inset-ring-hairline inset-ring-white/30'
              : '[--dashed-ring-color:rgba(255,255,255,0.25)]'
          }`}
          style={ownColorHex ? { backgroundColor: ownColorHex } : undefined}
        >
          {ownColorHex ? null : <DashedRing radius={10} />}
        </span>
      </span>
    </Tooltip>
  );
}
