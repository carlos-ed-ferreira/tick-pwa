import Dexie from 'dexie';
import type { AppScope, SyncEntityType, SyncOperation } from '@/lib/domain';
import {
  persistAccountEntity,
  restoreAccountEntity,
} from '@/lib/supabase/account-data';
import { db } from './database';

export const accountPersistenceErrorEvent = 'tick:account-persistence-error';

const persistenceQueues = new Map<string, Promise<void>>();

async function markAccountEntityPersisted({
  entityId,
  entityType,
  revision,
}: {
  entityType: SyncEntityType;
  entityId: string;
  revision: number | null;
}): Promise<void> {
  const update = {
    remoteRevision: revision,
    syncStatus: 'synced' as const,
  };

  if (entityType === 'categoryTag') {
    await db.categoryTags.update(entityId, update);
    return;
  }

  if (entityType === 'dailyEntry') {
    await db.dailyEntries.update(entityId, update);
    return;
  }

  if (entityType === 'checklistItem') {
    await db.checklistItems.update(entityId, update);
    return;
  }

  if (entityType === 'goal') {
    await db.goals.update(entityId, update);
    return;
  }

  await db.goalSteps.update(entityId, update);
}

function dispatchPersistenceError({
  entityId,
  entityType,
}: {
  entityType: SyncEntityType;
  entityId: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(accountPersistenceErrorEvent, {
      detail: { entityId, entityType },
    }),
  );
}

function enqueuePersistence(scopeId: string, task: () => Promise<void>) {
  const previousTask = persistenceQueues.get(scopeId) ?? Promise.resolve();
  const nextTask = previousTask
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (persistenceQueues.get(scopeId) === nextTask) {
        persistenceQueues.delete(scopeId);
      }
    });

  persistenceQueues.set(scopeId, nextTask);
}

export async function waitForAccountPersistence(scopeId?: string) {
  if (scopeId) {
    while (persistenceQueues.has(scopeId)) {
      await persistenceQueues.get(scopeId);
    }
    return;
  }

  while (persistenceQueues.size > 0) {
    await Promise.all([...persistenceQueues.values()]);
  }
}

export function persistAccountEntityChange({
  entityId,
  entityType,
  payload,
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  changedFields: string[];
  baseRevision: number | null;
}): void {
  if (scope.kind === 'guest') {
    return;
  }

  const persistAfterCommit = () => {
    enqueuePersistence(scope.id, async () => {
      try {
        const revision = await persistAccountEntity({
          entityType,
          payload,
          scope,
        });

        await markAccountEntityPersisted({
          entityId,
          entityType,
          revision,
        });
      } catch (error) {
        console.error('Failed to persist Tick account entity.', error);

        try {
          await restoreAccountEntity({ scope, entityType, entityId });
        } catch (restoreError) {
          console.error(
            'Failed to restore Tick account entity after persistence error.',
            restoreError,
          );
        }

        dispatchPersistenceError({ entityId, entityType });
      }
    });
  };

  const transaction = Dexie.currentTransaction;

  if (transaction) {
    transaction.on('complete', persistAfterCommit);
    return;
  }

  persistAfterCommit();
}
