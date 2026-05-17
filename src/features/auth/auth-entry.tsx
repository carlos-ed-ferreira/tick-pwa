'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AuthEntry() {
  const {
    authError,
    dictionary,
    enterLocalMode,
    isLoginConfigured,
    signInWithGoogle,
    signInWithPassword,
  } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isPasswordSigningIn, setIsPasswordSigningIn] = useState(false);

  async function handleGoogleSignIn() {
    setIsGoogleSigningIn(true);
    await signInWithGoogle();
    setIsGoogleSigningIn(false);
  }

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPasswordSigningIn(true);
    await signInWithPassword(email, password);
    setIsPasswordSigningIn(false);
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
          <form className="grid gap-3" onSubmit={handlePasswordSignIn}>
            <label className="grid gap-1.5 text-sm text-muted">
              <span>{dictionary.auth.emailLabel}</span>
              <input
                autoComplete="email"
                className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                disabled={
                  !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
                }
                placeholder={dictionary.auth.emailPlaceholder}
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-sm text-muted">
              <span>{dictionary.auth.passwordLabel}</span>
              <input
                autoComplete="current-password"
                className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                disabled={
                  !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
                }
                placeholder={dictionary.auth.passwordPlaceholder}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <Button
              className="min-h-12 justify-start px-4 text-left"
              disabled={
                !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
              }
              type="submit"
            >
              <span className="flex min-w-0 flex-col items-start gap-1">
                <span className="text-base font-semibold">
                  {isPasswordSigningIn
                    ? dictionary.auth.signingInWithPassword
                    : dictionary.auth.signInWithPassword}
                </span>
                <span className="text-sm font-normal text-muted">
                  {isLoginConfigured
                    ? dictionary.auth.passwordSignInDescription
                    : dictionary.auth.signInUnavailable}
                </span>
              </span>
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted/70">
            <span className="h-px flex-1 bg-border" />
            <span>{dictionary.auth.orContinueWith}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            className="min-h-16 justify-start bg-foreground px-4 text-left text-background hover:bg-foreground/90"
            disabled={
              !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
            }
            onClick={handleGoogleSignIn}
          >
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span className="text-base font-semibold">
                {isGoogleSigningIn
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
