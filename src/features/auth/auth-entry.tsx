'use client';

import { FormEvent, useState } from 'react';
import { Button, Input, Text } from '@/components/ui';
import { useAppContext } from '@/providers';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsGoogleSigningIn(true);
    await signInWithGoogle();
    setIsGoogleSigningIn(false);
  }

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    let nextEmailError: string | null = null;
    let nextPasswordError: string | null = null;

    if (!normalizedEmail) {
      nextEmailError = dictionary.auth.emailRequired;
    } else if (!isValidEmail(normalizedEmail)) {
      nextEmailError = dictionary.auth.emailInvalid;
    }

    if (!password) {
      nextPasswordError = dictionary.auth.passwordRequired;
    }

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setIsPasswordSigningIn(true);
    await signInWithPassword(normalizedEmail, password);
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
            <Text leading="relaxed" tone="muted">
              {dictionary.auth.subtitle}
            </Text>
          </div>
        </header>

        <div className="grid gap-3">
          <form
            noValidate
            className="grid gap-3"
            onSubmit={handlePasswordSignIn}
          >
            <label className="grid gap-1.5 text-sm text-muted">
              <span>{dictionary.auth.emailLabel}</span>
              <Input
                autoComplete="email"
                aria-describedby={emailError ? 'auth-email-error' : undefined}
                aria-invalid={emailError ? 'true' : 'false'}
                className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                disabled={
                  !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
                }
                placeholder={dictionary.auth.emailPlaceholder}
                type="text"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);

                  if (emailError) {
                    setEmailError(null);
                  }
                }}
              />
              {emailError ? (
                <Text as="span" id="auth-email-error" tone="danger">
                  {emailError}
                </Text>
              ) : null}
            </label>

            <label className="grid gap-1.5 text-sm text-muted">
              <span>{dictionary.auth.passwordLabel}</span>
              <Input
                autoComplete="current-password"
                aria-describedby={
                  passwordError ? 'auth-password-error' : undefined
                }
                aria-invalid={passwordError ? 'true' : 'false'}
                className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                disabled={
                  !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
                }
                placeholder={dictionary.auth.passwordPlaceholder}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);

                  if (passwordError) {
                    setPasswordError(null);
                  }
                }}
              />
              {passwordError ? (
                <Text as="span" id="auth-password-error" tone="danger">
                  {passwordError}
                </Text>
              ) : null}
            </label>

            <Button
              className="min-h-12 justify-start px-4 text-left"
              disabled={
                !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
              }
              type="submit"
            >
              <span className="flex min-w-0 flex-col items-start gap-1">
                <Text as="span" size="base" weight="semibold">
                  {isPasswordSigningIn
                    ? dictionary.auth.signingInWithPassword
                    : dictionary.auth.signInWithPassword}
                </Text>
                <Text as="span" tone="muted">
                  {isLoginConfigured
                    ? dictionary.auth.passwordSignInDescription
                    : dictionary.auth.signInUnavailable}
                </Text>
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
              <Text as="span" size="base" weight="semibold">
                {isGoogleSigningIn
                  ? dictionary.auth.signingIn
                  : dictionary.auth.signInWithGoogle}
              </Text>
              <Text as="span" tone="inverseMuted">
                {isLoginConfigured
                  ? dictionary.auth.signInDescription
                  : dictionary.auth.signInUnavailable}
              </Text>
            </span>
          </Button>

          <Button
            className="min-h-16 justify-start px-4 text-left"
            onClick={enterLocalMode}
          >
            <span className="flex min-w-0 flex-col items-start gap-1">
              <Text as="span" size="base" weight="semibold">
                {dictionary.auth.localMode}
              </Text>
              <Text as="span" tone="muted">
                {dictionary.auth.localModeDescription}
              </Text>
            </span>
          </Button>
        </div>

        <div className="space-y-1 text-sm leading-6 text-muted">
          <Text as="p" className="text-inherit">
            {dictionary.auth.allowedOnly}
          </Text>
          <Text as="p" className="text-inherit">
            {dictionary.auth.noSignup}
          </Text>
          {authError ? <Text tone="danger">{authError}</Text> : null}
        </div>
      </section>
    </main>
  );
}
