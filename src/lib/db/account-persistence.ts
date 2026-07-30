import Dexie from 'dexie';
import type { AppScope, SyncEntityType, SyncOperation } from '@/lib/domain';
import {
  persistAccountEntity,
  restoreAccountEntity,
} from '@/lib/supabase/account-data';
import { db } from './database';

const persistenceQueues = new Map<string, Promise<void>>();

interface PersistedAccountEntity {
  clientUpdatedAt: string;
  remoteRevision: number | null;
  syncStatus: 'local' | 'pending' | 'syncing' | 'synced' | 'failed';
}

function getAccountEntityTable(entityType: SyncEntityType) {
  if (entityType === 'categoryTag') {
    return db.categoryTags as Dexie.Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'dailyEntry') {
    return db.dailyEntries as Dexie.Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'checklistItem') {
    return db.checklistItems as Dexie.Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'goalGroup') {
    return db.goalGroups as Dexie.Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'goal') {
    return db.goals as Dexie.Table<PersistedAccountEntity, string>;
  }

  return db.goalSteps as Dexie.Table<PersistedAccountEntity, string>;
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
) {
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
}): void {
  if (scope.kind === 'guest') {
    return;
  }

  const clientUpdatedAt = payload.clientUpdatedAt;

  if (typeof clientUpdatedAt !== 'string') {
    throw new Error(
      'Account persistence requires a clientUpdatedAt version token.',
    );
  }

  const persistAfterCommit = () => {
    enqueueAccountPersistence(scope.id, async () => {
      try {
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
        } else {
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
          }
        }
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
