'use client';

import { Cloud, LogOut, UserRound } from 'lucide-react';
import { Button, Tooltip } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AccountStatus() {
  const { authMode, authUser, dictionary, openAuthEntry, signOut } =
    useAppContext();

  if (authMode === 'authenticated') {
    const email = authUser?.email || dictionary.auth.cloudModeBadge;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip content={email}>
          <span className="inline-flex min-h-10 max-w-[13rem] items-center gap-2 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/6 px-3.5 text-xs font-medium text-[#cbd5e0] shadow-sm shadow-[#253241]/10">
            <UserRound
              aria-hidden="true"
              className="size-4 shrink-0 text-[#f0c38e]"
            />
            <span className="truncate">{email}</span>
          </span>
        </Tooltip>
        <Button
          className="min-h-10 rounded-full inset-ring-white/10 bg-white/5 px-4 text-sm text-[#f8f3ea] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-[#f7d9b0]"
          tone="subtle"
          onClick={signOut}
        >
          <LogOut aria-hidden="true" className="size-4 text-[#f0c38e]" />
          {dictionary.auth.signOut}
        </Button>
      </div>
    );
  }

  if (authMode === 'guest') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-7 items-center rounded-full inset-ring-hairline inset-ring-[#f0c38e]/60 bg-[#f0c38e]/14 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#f7e8ce] shadow-sm shadow-[#f0c38e]/10">
          {dictionary.auth.localModeBadge}
        </span>
        <Button
          className="min-h-10 rounded-full inset-ring-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-[#f8f3ea] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-[#f7d9b0] sm:text-sm"
          tone="subtle"
          onClick={openAuthEntry}
        >
          <Cloud aria-hidden="true" className="size-4 text-[#f0c38e]" />
          {dictionary.auth.signInWithPassword}
        </Button>
      </div>
    );
  }

  return null;
}
