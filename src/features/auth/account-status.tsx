'use client';

import { Cloud, LogOut } from 'lucide-react';
import {
  filledPillControlClassName,
  filledRoundControlClassName,
  filledControlNeutralClassName,
} from '@/components/ui';
import { Tooltip } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AccountStatus() {
  const { authMode, authUser, dictionary, openAuthEntry, signOut } =
    useAppContext();

  if (authMode === 'authenticated') {
    const email = authUser?.email || dictionary.auth.cloudModeBadge;

    return (
      <Tooltip
        content={
          <span className="grid gap-0.5">
            <span>{dictionary.auth.signOut}</span>
            <span className="break-all opacity-75">{email}</span>
          </span>
        }
      >
        <button
          aria-label={dictionary.auth.signOut}
          className={`${filledRoundControlClassName} ${filledControlNeutralClassName}`}
          type="button"
          onClick={signOut}
        >
          <LogOut aria-hidden="true" className="size-4 text-[#f0c38e]" />
        </button>
      </Tooltip>
    );
  }

  if (authMode === 'guest') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-7 items-center rounded-full bg-[#f0c38e]/14 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#f7e8ce] shadow-sm shadow-[#f0c38e]/10">
          {dictionary.auth.localModeBadge}
        </span>
        <button
          className={filledPillControlClassName}
          type="button"
          onClick={openAuthEntry}
        >
          <Cloud aria-hidden="true" className="size-4 text-[#f0c38e]" />
          {dictionary.auth.signInWithPassword}
        </button>
      </div>
    );
  }

  return null;
}
