'use client';

import { Check, Cloud, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import type { AppScope } from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n';
import { useAccountSyncStatus } from './use-account-sync-status';

const stateStyles = {
  saved:
    'inset-ring-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 focus-visible:outline-emerald-200',
  syncing:
    'inset-ring-sky-300/20 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20 focus-visible:outline-sky-200',
  pending:
    'inset-ring-amber-300/25 bg-amber-400/12 text-amber-100 hover:bg-amber-400/20 focus-visible:outline-amber-200',
  failed:
    'inset-ring-rose-300/30 bg-rose-400/12 text-rose-100 hover:bg-rose-400/20 focus-visible:outline-rose-200',
} as const;

export function AccountSyncIndicator({
  dictionary,
  scope,
}: {
  dictionary: Dictionary['sync'];
  scope: AppScope | null;
}) {
  const { retry, summary } = useAccountSyncStatus(scope);
  const [isSyncing, setIsSyncing] = useState(false);
  const statusLabel = dictionary[summary.state];
  const actionLabel = isSyncing
    ? summary.state === 'failed'
      ? dictionary.retrying
      : dictionary.forcing
    : summary.state === 'failed'
      ? dictionary.retry
      : dictionary.force;

  const forceSync = async () => {
    setIsSyncing(true);

    try {
      await retry();
    } catch (error) {
      console.error('Failed to force a Tick account sync.', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        aria-label={`${statusLabel}. ${actionLabel}`}
        className={`min-h-10 rounded-full px-3.5 text-xs ${stateStyles[summary.state]}`}
        disabled={isSyncing}
        tone="subtle"
        onClick={() => void forceSync()}
      >
        {isSyncing ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : summary.state === 'failed' ? (
          <CloudOff aria-hidden="true" className="size-4" />
        ) : summary.state === 'saved' ? (
          <Check aria-hidden="true" className="size-4" />
        ) : summary.state === 'syncing' ? (
          <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Cloud aria-hidden="true" className="size-4" />
        )}
        <span>{statusLabel}</span>
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {statusLabel}
      </span>
    </>
  );
}
