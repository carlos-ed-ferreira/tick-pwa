'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import type { AppScope } from '@/lib/domain';
import {
  forceSyncAccount,
  getAccountSyncSummary,
  type AccountSyncSummary,
} from '@/lib/db/account-persistence';

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
  const retry = useCallback(async () => {
    if (scope?.kind !== 'user') {
      return;
    }

    await forceSyncAccount(scope);
  }, [scope]);

  return {
    retry,
    summary,
  };
}
