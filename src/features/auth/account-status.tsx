'use client';

import { Button } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AccountStatus() {
  const {
    authMode,
    authUser,
    dictionary,
    isLoginConfigured,
    signInWithGoogle,
    signOut,
  } = useAppContext();

  if (authMode === 'authenticated') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
          {authUser?.email || dictionary.auth.cloudModeBadge}
        </span>
        <Button className="min-h-9 px-3" onClick={signOut}>
          {dictionary.auth.signOut}
        </Button>
      </div>
    );
  }

  if (authMode === 'guest') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
          {dictionary.auth.localModeBadge}
        </span>
        <Button
          className="min-h-9 px-3"
          disabled={!isLoginConfigured}
          onClick={signInWithGoogle}
        >
          {dictionary.auth.switchToLogin}
        </Button>
      </div>
    );
  }

  return null;
}
