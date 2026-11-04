'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BottomSheet, FilledIconButton } from '@/components/ui';
import { useAppContext } from '@/providers';

export function GoalDetailActionsSheet({ children }: { children: ReactNode }) {
  const { dictionary } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <FilledIconButton
        aria-label={dictionary.navigation.moreOptions}
        onClick={() => setIsOpen(true)}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </FilledIconButton>
      <BottomSheet
        closeLabel={dictionary.actions.cancel}
        open={isOpen}
        title={dictionary.navigation.moreOptions}
        onClose={() => setIsOpen(false)}
      >
        <div className="flex flex-wrap items-center gap-3 px-1">{children}</div>
      </BottomSheet>
    </>
  );
}
