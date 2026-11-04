'use client';

import { Tags } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
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
      <Button
        tone="subtle"
        className="rounded-full inset-ring-white/10 bg-white/5 px-4 text-[#fff9f2] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:text-[#fff9f2] hover:shadow-md focus-visible:outline-[#f0c38e] active:translate-y-0"
        onClick={() => setIsOpen(true)}
      >
        <Tags aria-hidden="true" className="size-4 text-[#f0c38e]" />
        <span>{dictionary.navigation.categories}</span>
      </Button>
      <CategoryManagerDialog
        open={isOpen}
        surface={surface}
        title={title}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
