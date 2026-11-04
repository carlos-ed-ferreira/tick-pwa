'use client';

import { Tags } from 'lucide-react';
import { useState } from 'react';
import { headerPillControlClassName } from '@/components/app/header-control';
import type { CategoryTagSurface } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { CategoryManagerDialog } from './category-manager';

export function CategoryManagerAction({
  surface,
  title,
}: {
  surface: CategoryTagSurface;
  title: string;
}) {
  const { dictionary } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={headerPillControlClassName}
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
