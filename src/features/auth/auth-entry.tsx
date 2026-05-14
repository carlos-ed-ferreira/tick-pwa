'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AuthEntry() {
  const {
    authError,
    dictionary,
    enterLocalMode,
    isLoginConfigured,
    signInWithGoogle,
  } = useAppContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSignIn() {
    setIsSigningIn(true);
    await signInWithGoogle();
    setIsSigningIn(false);
  }

  return (
    <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground sm:px-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-7">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">{dictionary.app.name}</h1>
            <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
              {dictionary.auth.prototypeNotice}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{dictionary.auth.title}</h2>
            <p className="text-sm leading-6 text-muted">
              {dictionary.auth.subtitle}
            </p>
          </div>
        </header>

        <div className="grid gap-3">
          <Button
            className="min-h-16 justify-start bg-foreground px-4 text-left text-background hover:bg-foreground/90"
            disabled={!isLoginConfigured || isSigningIn}
            onClick={handleSignIn}
          >
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span className="text-base font-semibold">
                {isSigningIn
                  ? dictionary.auth.signingIn
                  : dictionary.auth.signInWithGoogle}
              </span>
              <span className="text-sm font-normal text-background/70">
                {isLoginConfigured
                  ? dictionary.auth.signInDescription
                  : dictionary.auth.signInUnavailable}
              </span>
            </span>
          </Button>

          <Button
            className="min-h-16 justify-start px-4 text-left"
            onClick={enterLocalMode}
          >
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span className="text-base font-semibold">
                {dictionary.auth.localMode}
              </span>
              <span className="text-sm font-normal text-muted">
                {dictionary.auth.localModeDescription}
              </span>
            </span>
          </Button>
        </div>

        <div className="space-y-1 text-sm leading-6 text-muted">
          <p>{dictionary.auth.allowedOnly}</p>
          <p>{dictionary.auth.noSignup}</p>
          {authError ? <p className="text-rose-600">{authError}</p> : null}
        </div>
      </section>
    </main>
  );
}
