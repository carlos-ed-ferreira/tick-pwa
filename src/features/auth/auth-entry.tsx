'use client';

import { FormEvent, useState } from 'react';
import { CloudOff, KeyRound } from 'lucide-react';
import { ActionButton, FormField, Text } from '@/components/ui';
import { useAppContext } from '@/providers';
import { AuthShell } from './auth-shell';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="size-4">
      <path
        d="M21.35 12.21c0-.73-.06-1.27-.18-1.84H12v3.48h5.29c-.11.86-.66 2.15-1.89 3.02l-.02.12 2.73 2.11.19.02c1.72-1.59 3.05-3.92 3.05-6.91Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.46 0 4.52-.81 6.02-2.18l-2.87-2.23c-.77.53-1.8.91-3.15.91a5.46 5.46 0 0 1-5.16-3.77l-.11.01-2.84 2.2-.03.1A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.84 14.73a6.6 6.6 0 0 1 0-4.46l-.01-.11L3.95 7.9l-.09.04a10 10 0 0 0 0 8.11l2.98-2.32Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.71 0 2.86.74 3.52 1.36l2.57-2.51C16.51 2.72 14.46 2 12 2a10 10 0 0 0-8.05 4.1l2.9 2.24A5.45 5.45 0 0 1 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthEntry() {
  const {
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
    try {
      await signInWithGoogle();
    } finally {
      setIsGoogleSigningIn(false);
    }
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
    try {
      await signInWithPassword(normalizedEmail, password);
    } finally {
      setIsPasswordSigningIn(false);
    }
  }

  return (
    <AuthShell
      badge={dictionary.auth.prototypeNotice}
      subtitle={dictionary.auth.subtitle}
      title={dictionary.auth.title}
    >
      <div className="grid gap-5">
        <form className="grid gap-4" noValidate onSubmit={handlePasswordSignIn}>
          <div className="grid gap-3">
            <Text as="p" className="px-1 text-xl mb-6">
              {dictionary.auth.passwordFormHint}
            </Text>

            <FormField
              autoComplete="email"
              disabled={
                !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
              }
              error={emailError}
              label={dictionary.auth.emailLabel}
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

            <FormField
              autoComplete="current-password"
              disabled={
                !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
              }
              error={passwordError}
              label={dictionary.auth.passwordLabel}
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
          </div>

          <ActionButton
            className="mt-1"
            disabled={
              !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
            }
            icon={<KeyRound className="size-4" />}
            description={dictionary.auth.passwordSignInDescription}
            label={
              isPasswordSigningIn
                ? dictionary.auth.signingInWithPassword
                : dictionary.auth.signInWithPassword
            }
            tone="primary"
            type="submit"
          />
        </form>

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-[#fff9f2]/78 my-3">
          <span className="h-px flex-1 bg-[#fff9f2]/20" />
          <span>{dictionary.auth.orContinueWith}</span>
          <span className="h-px flex-1 bg-[#fff9f2]/20" />
        </div>

        <div className="grid gap-3">
          <ActionButton
            disabled={
              !isLoginConfigured || isGoogleSigningIn || isPasswordSigningIn
            }
            description={dictionary.auth.signInDescription}
            icon={<GoogleIcon />}
            label={
              isGoogleSigningIn
                ? dictionary.auth.signingIn
                : dictionary.auth.signInWithGoogle
            }
            onClick={handleGoogleSignIn}
            tone="secondary"
          />

          <ActionButton
            description={dictionary.auth.localModeDescription}
            icon={<CloudOff className="size-4" />}
            label={dictionary.auth.localMode}
            onClick={enterLocalMode}
            tone="accent"
          />
        </div>
      </div>
    </AuthShell>
  );
}
