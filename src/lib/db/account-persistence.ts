import Dexie from 'dexie';
import type { AppScope, SyncEntityType, SyncOperation } from '@/lib/domain';
import { shouldUseAccountOperationBatchesForUser } from '@/lib/environment';
import {
  persistAccountEntity,
  restoreAccountEntity,
} from '@/lib/supabase/account-data';
import {
  getAccountOperationOutboxSummary,
  persistAccountOperationMutation,
  retryFailedAccountOperationOutbox,
  waitForAccountOperationOutbox,
} from './account-operation-outbox';
import {
  accountEntityTypes,
  getAccountEntityTable,
} from './account-entity-tables';
import { syncAccountFromThisDevice } from './account-sync';

const persistenceQueues = new Map<string, Promise<void>>();

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export type AccountSyncState = 'saved' | 'pending' | 'syncing' | 'failed';

export interface AccountSyncSummary {
  state: AccountSyncState;
  failedCount: number;
  pendingCount: number;
  syncingCount: number;
}

async function markAccountEntityPersisted({
  clientUpdatedAt,
  entityId,
  entityType,
  revision,
}: {
  entityType: SyncEntityType;
  entityId: string;
  clientUpdatedAt: string;
  revision: number | null;
}): Promise<void> {
  await getAccountEntityTable(entityType)
    .where(':id')
    .equals(entityId)
    .modify((entity) => {
      if (entity.clientUpdatedAt !== clientUpdatedAt) {
        return;
      }

      entity.remoteRevision = revision;
      entity.syncStatus = 'synced';
    });
}

async function markAccountEntityFailed({
  clientUpdatedAt,
  entityId,
  entityType,
}: {
  entityType: SyncEntityType;
  entityId: string;
  clientUpdatedAt: string;
}): Promise<void> {
  await getAccountEntityTable(entityType)
    .where(':id')
    .equals(entityId)
    .modify((entity) => {
      if (entity.clientUpdatedAt === clientUpdatedAt) {
        entity.syncStatus = 'failed';
      }
    });
}

async function markAccountEntitySyncing({
  clientUpdatedAt,
  entityId,
  entityType,
}: {
  entityType: SyncEntityType;
  entityId: string;
  clientUpdatedAt: string;
}): Promise<void> {
  await getAccountEntityTable(entityType)
    .where(':id')
    .equals(entityId)
    .modify((entity) => {
      if (entity.clientUpdatedAt === clientUpdatedAt) {
        entity.syncStatus = 'syncing';
      }
    });
}

async function isCurrentAccountEntityVersion({
  clientUpdatedAt,
  entityId,
  entityType,
}: {
  entityType: SyncEntityType;
  entityId: string;
  clientUpdatedAt: string;
}): Promise<boolean> {
  const entity = await getAccountEntityTable(entityType).get(entityId);

  return entity?.clientUpdatedAt === clientUpdatedAt;
}

export function enqueueAccountPersistence(
  scopeId: string,
  task: () => Promise<void>,
): Promise<void> {
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

  return nextTask;
}

export async function waitForAccountPersistence(scopeId?: string) {
  if (scopeId) {
    while (persistenceQueues.has(scopeId)) {
      await persistenceQueues.get(scopeId);
    }
    await waitForAccountOperationOutbox(scopeId);
    return;
  }

  while (persistenceQueues.size > 0) {
    await Promise.all([...persistenceQueues.values()]);
  }

  await waitForAccountOperationOutbox(scopeId);
}

export async function getAccountSyncSummary(
  scopeId: string,
): Promise<AccountSyncSummary> {
  const ownerId = scopeId.startsWith('user:') ? scopeId.slice(5) : null;

  if (ownerId && shouldUseAccountOperationBatchesForUser(ownerId)) {
    const summary = await getAccountOperationOutboxSummary(scopeId);
    const state: AccountSyncState = summary.failedCount
      ? 'failed'
      : summary.syncingCount
        ? 'syncing'
        : summary.pendingCount
          ? 'pending'
          : 'saved';

    return { ...summary, state };
  }

  const entities = (
    await Promise.all(
      accountEntityTypes.map((entityType) =>
        getAccountEntityTable(entityType)
          .where('scopeId')
          .equals(scopeId)
          .toArray(),
      ),
    )
  ).flat();
  const failedCount = entities.filter(
    (entity) => entity.syncStatus === 'failed',
  ).length;
  const syncingCount = entities.filter(
    (entity) => entity.syncStatus === 'syncing',
  ).length;
  const pendingCount = entities.filter(
    (entity) => entity.syncStatus === 'pending',
  ).length;
  const state: AccountSyncState = failedCount
    ? 'failed'
    : syncingCount
      ? 'syncing'
      : pendingCount
        ? 'pending'
        : 'saved';

  return {
    state,
    failedCount,
    pendingCount,
    syncingCount,
  };
}

export async function retryFailedAccountPersistence(
  scope: AppScope,
): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  if (shouldUseAccountOperationBatchesForUser(scope.ownerId)) {
    await retryFailedAccountOperationOutbox(scope);
    return;
  }

  const candidates = (
    await Promise.all(
      accountEntityTypes.map(async (entityType) => {
        const entities = await getAccountEntityTable(entityType)
          .where('scopeId')
          .equals(scope.id)
          .filter(
            (entity) =>
              entity.syncStatus === 'failed' || entity.syncStatus === 'syncing',
          )
          .toArray();

        return entities.map((entity) => ({
          clientUpdatedAt: entity.clientUpdatedAt,
          entityId: entity.id,
          entityType,
        }));
      }),
    )
  ).flat();

  await Promise.all(
    candidates.map((candidate) =>
      enqueueAccountPersistence(scope.id, async () => {
        const table = getAccountEntityTable(candidate.entityType);
        const entity = await table.get(candidate.entityId);

        if (
          entity?.scopeId !== scope.id ||
          entity.clientUpdatedAt !== candidate.clientUpdatedAt ||
          (entity.syncStatus !== 'failed' && entity.syncStatus !== 'syncing')
        ) {
          return;
        }

        if (isBrowserOffline()) {
          return;
        }

        await markAccountEntitySyncing(candidate);

        try {
          const revision = await persistAccountEntity({
            entityType: candidate.entityType,
            payload: entity as unknown as Record<string, unknown>,
            scope,
          });

          await markAccountEntityPersisted({
            ...candidate,
            revision,
          });
        } catch (error) {
          console.error('Failed to retry Tick account entity.', error);
          await markAccountEntityFailed(candidate);
        }
      }),
    ),
  );
}

export async function forceSyncAccount(scope: AppScope): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  await enqueueAccountPersistence(scope.id, () =>
    syncAccountFromThisDevice(scope),
  );
}

async function persistQueuedAccountEntityChange({
  baseRevision,
  clientUpdatedAt,
  entityId,
  entityType,
  operation,
  payload,
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  baseRevision: number | null;
  clientUpdatedAt: string;
}): Promise<void> {
  if (isBrowserOffline()) {
    await markAccountEntityFailed({
      clientUpdatedAt,
      entityId,
      entityType,
    });
    return;
  }

  try {
    await markAccountEntitySyncing({
      clientUpdatedAt,
      entityId,
      entityType,
    });

    const revision = await persistAccountEntity({
      entityType,
      payload,
      scope,
    });

    await markAccountEntityPersisted({
      clientUpdatedAt,
      entityId,
      entityType,
      revision,
    });
  } catch (error) {
    console.error('Failed to persist Tick account entity.', error);

    if (baseRevision === null && operation === 'upsert') {
      await markAccountEntityFailed({
        clientUpdatedAt,
        entityId,
        entityType,
      });
      return;
    }

    try {
      const isCurrentVersion = await isCurrentAccountEntityVersion({
        clientUpdatedAt,
        entityId,
        entityType,
      });

      if (!isCurrentVersion) {
        return;
      }

      await restoreAccountEntity({
        scope,
        entityType,
        entityId,
        expectedClientUpdatedAt: clientUpdatedAt,
      });
    } catch (restoreError) {
      console.error(
        'Failed to restore Tick account entity after persistence error.',
        restoreError,
      );
      await markAccountEntityFailed({
        clientUpdatedAt,
        entityId,
        entityType,
      });
    }
  }
}

export async function persistAccountEntityChange({
  entityId,
  entityType,
  operation,
  payload,
  scope,
  baseRevision,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  changedFields: string[];
  baseRevision: number | null;
}): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  const clientUpdatedAt = payload.clientUpdatedAt;

  if (typeof clientUpdatedAt !== 'string') {
    throw new Error(
      'Account persistence requires a clientUpdatedAt version token.',
    );
  }

  if (shouldUseAccountOperationBatchesForUser(scope.ownerId)) {
    await persistAccountOperationMutation({
      baseRevision,
      clientUpdatedAt,
      entityId,
      entityType,
      operation,
      payload,
      scope,
    });
    return;
  }

  const persistAfterCommit = () => {
    enqueueAccountPersistence(scope.id, () =>
      persistQueuedAccountEntityChange({
        baseRevision,
        clientUpdatedAt,
        entityId,
        entityType,
        operation,
        payload,
        scope,
      }),
    );
  };

  const transaction = Dexie.currentTransaction;

  if (transaction) {
    transaction.on('complete', persistAfterCommit);
    return;
  }

  persistAfterCommit();
}

export function resumeAccountPersistence(scope: AppScope): Promise<void> {
  if (scope.kind !== 'user') {
    return Promise.resolve();
  }

  if (shouldUseAccountOperationBatchesForUser(scope.ownerId)) {
    return retryFailedAccountOperationOutbox(scope);
  }

  return retryFailedAccountPersistence(scope);
}
