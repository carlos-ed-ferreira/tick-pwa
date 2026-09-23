'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BottomSheet, IconButton } from '@/components/ui';
import { useAppContext } from '@/providers';

export function GoalDetailActionsSheet({ children }: { children: ReactNode }) {
  const { dictionary } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <IconButton
        aria-label={dictionary.navigation.moreOptions}
        className="size-10 rounded-md inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] shadow-sm shadow-[#253241]/10 hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f7d9b0]"
        onClick={() => setIsOpen(true)}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </IconButton>
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
