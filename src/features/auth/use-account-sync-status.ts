'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import type { AppScope } from '@/lib/domain';
import {
  forceSyncAccount,
  getAccountSyncSummary,
  type AccountSyncSummary,
} from '@/lib/db/account-persistence';

const SYNC_VISIBILITY_DELAY_MS = 800;

const savedSummary: AccountSyncSummary = {
  state: 'saved',
  failedCount: 0,
  pendingCount: 0,
  syncingCount: 0,
};

export function useAccountSyncStatus(scope: AppScope | null): {
  retry: () => Promise<void>;
  summary: AccountSyncSummary;
} {
  const summary =
    useLiveQuery(
      () =>
        scope?.kind === 'user'
          ? getAccountSyncSummary(scope.id)
          : Promise.resolve(savedSummary),
      [scope?.id, scope?.kind],
      savedSummary,
    ) ?? savedSummary;
  const isTransientActivity =
    summary.state === 'pending' || summary.state === 'syncing';
  const [isActivityVisible, setIsActivityVisible] = useState(false);

  useEffect(() => {
    if (!isTransientActivity) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsActivityVisible(true);
    }, SYNC_VISIBILITY_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      setIsActivityVisible(false);
    };
  }, [isTransientActivity]);

  const retry = useCallback(async () => {
    if (scope?.kind !== 'user') {
      return;
    }

    await forceSyncAccount(scope);
  }, [scope]);

  return {
    retry,
    summary: isTransientActivity && !isActivityVisible ? savedSummary : summary,
  };
}
