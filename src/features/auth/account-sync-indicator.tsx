'use client';

import { Check, Cloud, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { headerRoundControlClassName } from '@/components/app/header-control';
import { Tooltip } from '@/components/ui';
import type { AppScope } from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n';
import { useAccountSyncStatus } from './use-account-sync-status';

const stateStyles = {
  saved:
    'bg-emerald-400/14 text-emerald-100 hover:bg-emerald-400/22 focus-visible:outline-emerald-200',
  syncing:
    'bg-sky-400/14 text-sky-100 hover:bg-sky-400/22 focus-visible:outline-sky-200',
  pending:
    'bg-amber-400/16 text-amber-100 hover:bg-amber-400/24 focus-visible:outline-amber-200',
  failed:
    'bg-rose-400/16 text-rose-100 hover:bg-rose-400/24 focus-visible:outline-rose-200',
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
      <Tooltip content={statusLabel}>
        <button
          aria-label={`${statusLabel}. ${actionLabel}`}
          className={`${headerRoundControlClassName} ${stateStyles[summary.state]}`}
          disabled={isSyncing}
          type="button"
          onClick={() => void forceSync()}
        >
          {isSyncing ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin"
            />
          ) : summary.state === 'failed' ? (
            <CloudOff aria-hidden="true" className="size-4 shrink-0" />
          ) : summary.state === 'saved' ? (
            <Check aria-hidden="true" className="size-4 shrink-0" />
          ) : summary.state === 'syncing' ? (
            <RefreshCw
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin"
            />
          ) : (
            <Cloud aria-hidden="true" className="size-4 shrink-0" />
          )}
        </button>
      </Tooltip>
      <span aria-live="polite" className="sr-only" role="status">
        {statusLabel}
      </span>
    </>
  );
}
