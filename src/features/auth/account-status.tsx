'use client';

import { Button } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AccountStatus() {
  const {
    authMode,
    authUser,
    dictionary,
    isLoginConfigured,
    openAuthEntry,
    signOut,
  } = useAppContext();

  if (authMode === 'authenticated') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="max-w-[13rem] truncate rounded-full border border-white/10 bg-background/45 px-3 py-1 text-xs font-medium text-[#d8d0e8] shadow-sm shadow-[#312c51]/10">
          {authUser?.email || dictionary.auth.cloudModeBadge}
        </span>
        <Button className="min-h-9 px-3" tone="subtle" onClick={signOut}>
          {dictionary.auth.signOut}
        </Button>
      </div>
    );
  }

  if (authMode === 'guest') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-background/45 px-3 py-1 text-xs font-medium text-[#d8d0e8] shadow-sm shadow-[#312c51]/10">
          {dictionary.auth.localModeBadge}
        </span>
        <Button
          className="min-h-9 px-3"
          tone="subtle"
          disabled={!isLoginConfigured}
          onClick={openAuthEntry}
        >
          {dictionary.auth.switchToLogin}
        </Button>
      </div>
    );
  }

  return null;
}
