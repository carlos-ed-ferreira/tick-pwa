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
        <div className="grid items-center gap-3 px-1 [&_button[aria-label]:has(>svg:only-child)]:w-full [&_button[aria-label]:has(>svg:only-child)]:justify-start [&_button[aria-label]:has(>svg:only-child)]:gap-3 [&_button[aria-label]:has(>svg:only-child)]:px-3 [&_button[aria-label]:has(>svg:only-child)]:after:content-[attr(aria-label)]">
          {children}
        </div>
      </BottomSheet>
    </>
  );
}
