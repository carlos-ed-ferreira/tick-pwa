'use client';

import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { ActionButton, Text } from '@/components/ui';
import { useAppContext } from '@/providers';
import { AuthEntry } from './auth-entry';
import { AuthShell } from './auth-shell';

function LoadingAuthState() {
  const { dictionary } = useAppContext();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <Text tone="muted">{dictionary.auth.loading}</Text>
    </main>
  );
}

function UnauthorizedAuthState() {
  const { dictionary, enterLocalMode, signOut } = useAppContext();

  return (
    <AuthShell
      badge={dictionary.auth.cloudModeBadge}
      subtitle={dictionary.auth.unauthorizedDescription}
      title={dictionary.auth.unauthorizedTitle}
    >
      <div className="grid gap-3">
        <ActionButton
          description={dictionary.auth.localModeDescription}
          label={dictionary.auth.continueLocal}
          onClick={enterLocalMode}
          tone="primary"
        />
        <ActionButton
          icon={<LogOut className="size-4" />}
          label={dictionary.auth.signOut}
          onClick={signOut}
          tone="secondary"
        />
      </div>
      <Text as="p" className="text-sm leading-6 text-muted">
        {dictionary.auth.allowedOnly}
      </Text>
    </AuthShell>
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
