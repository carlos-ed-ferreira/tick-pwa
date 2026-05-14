'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { useAppContext } from '@/providers';
import { AuthEntry } from './auth-entry';

function LoadingAuthState() {
  const { dictionary } = useAppContext();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <p className="text-sm text-muted">{dictionary.auth.loading}</p>
    </main>
  );
}

function UnauthorizedAuthState() {
  const { dictionary, enterLocalMode, signOut } = useAppContext();

  return (
    <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground sm:px-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {dictionary.auth.unauthorizedTitle}
          </h1>
          <p className="text-sm leading-6 text-muted">
            {dictionary.auth.unauthorizedDescription}
          </p>
        </header>
        <div className="grid gap-3">
          <Button onClick={enterLocalMode}>
            {dictionary.auth.continueLocal}
          </Button>
          <Button className="bg-transparent shadow-none" onClick={signOut}>
            {dictionary.auth.signOut}
          </Button>
        </div>
      </section>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { authMode, isReady, scope } = useAppContext();

  if (!isReady || authMode === 'loading') {
    return <LoadingAuthState />;
  }

  if (authMode === 'unauthorized') {
    return <UnauthorizedAuthState />;
  }

  if (!scope) {
    return <AuthEntry />;
  }

  return children;
}
