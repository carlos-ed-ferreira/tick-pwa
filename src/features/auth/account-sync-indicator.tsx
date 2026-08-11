'use client';

import { Check, Cloud, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import type { AppScope } from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n';
import { useAccountSyncStatus } from './use-account-sync-status';

export function AccountSyncIndicator({
  dictionary,
  scope,
}: {
  dictionary: Dictionary['sync'];
  scope: AppScope | null;
}) {
  const { retry, summary } = useAccountSyncStatus(scope);
  const [isRetrying, setIsRetrying] = useState(false);
  const statusLabel = dictionary[summary.state];

  const retrySync = async () => {
    setIsRetrying(true);

    try {
      await retry();
    } finally {
      setIsRetrying(false);
    }
  };

  if (summary.state === 'failed') {
    return (
      <Button
        aria-label={`${dictionary.failed}. ${isRetrying ? dictionary.retrying : dictionary.retry}`}
        className="min-h-10 rounded-full inset-ring-rose-300/30 bg-rose-400/12 px-3.5 text-xs text-rose-100 hover:bg-rose-400/20 focus-visible:outline-rose-200"
        disabled={isRetrying}
        tone="subtle"
        onClick={() => void retrySync()}
      >
        {isRetrying ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <CloudOff aria-hidden="true" className="size-4" />
        )}
        <span>{dictionary.failed}</span>
        <span aria-hidden="true">·</span>
        <span>{isRetrying ? dictionary.retrying : dictionary.retry}</span>
      </Button>
    );
  }

  return (
    <span
      aria-live="polite"
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-xs font-medium ${
        summary.state === 'saved'
          ? 'inset-ring-emerald-300/20 bg-emerald-400/10 text-emerald-100'
          : summary.state === 'syncing'
            ? 'inset-ring-sky-300/20 bg-sky-400/10 text-sky-100'
            : 'inset-ring-amber-300/25 bg-amber-400/12 text-amber-100'
      }`}
      role="status"
    >
      {summary.state === 'saved' ? (
        <Check aria-hidden="true" className="size-4" />
      ) : summary.state === 'syncing' ? (
        <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Cloud aria-hidden="true" className="size-4" />
      )}
      {statusLabel}
    </span>
  );
}
