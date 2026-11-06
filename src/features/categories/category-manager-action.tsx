'use client';

import { Tags } from 'lucide-react';
import { useState } from 'react';
import { filledPillControlClassName } from '@/components/ui';
import type { CategoryTagSurface } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { CategoryManagerDialog } from './category-manager';

export function CategoryManagerAction({
  className = filledPillControlClassName,
  surface,
  title,
}: {
  className?: string;
  surface: CategoryTagSurface;
  title: string;
}) {
  const { dictionary } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <Tags aria-hidden="true" className="size-4 text-[#f0c38e]" />
        <span>{dictionary.navigation.categories}</span>
      </button>
      <CategoryManagerDialog
        open={isOpen}
        surface={surface}
        title={title}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
