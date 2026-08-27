import type { AppScope, SyncEntityType } from '@/lib/domain';
import { refreshAccountCache } from '@/lib/supabase/account-cache';
import { fetchRemoteEntityRevisions } from '@/lib/supabase/account-data';
import {
  applyAccountOperationBatch,
  isStaleRevisionError,
  type AccountOperationResult,
} from '@/lib/supabase/account-operations';
import { db } from './database';
import {
  accountEntityTypes,
  collectPendingEntityClosure,
  createOperationId,
  getAccountEntityTable,
  type PersistedAccountEntity,
} from './account-entity-tables';

const SYNC_BATCH_SIZE = 100;

interface SyncMutation {
  baseRevision: number | null;
  clientUpdatedAt: string;
  entityId: string;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
}

function orderByHierarchy(
  entities: PersistedAccountEntity[],
): PersistedAccountEntity[] {
  const pending = new Map(entities.map((entity) => [entity.id, entity]));
  const ordered: PersistedAccountEntity[] = [];

  let progressed = true;

  while (pending.size > 0 && progressed) {
    progressed = false;

    for (const [id, entity] of [...pending]) {
      const parentId = entity.parentId ?? null;

      if (!parentId || !pending.has(parentId)) {
        ordered.push(entity);
        pending.delete(id);
        progressed = true;
      }
    }
  }

  return [...ordered, ...pending.values()];
}

async function collectSyncMutations(scope: AppScope): Promise<SyncMutation[]> {
  const closure = await collectPendingEntityClosure(scope.id);

  if ([...closure.values()].every((ids) => ids.size === 0)) {
    return [];
  }

  const mutations: SyncMutation[] = [];

  for (const entityType of accountEntityTypes) {
    const candidateIds = [...(closure.get(entityType) ?? [])];

    if (candidateIds.length === 0) {
      continue;
    }

    const table = getAccountEntityTable(entityType);
    const candidates = (
      await Promise.all(candidateIds.map((id) => table.get(id)))
    ).filter(
      (entity): entity is PersistedAccountEntity =>
        entity !== undefined && entity.scopeId === scope.id,
    );
    const revisions = await fetchRemoteEntityRevisions({
      entityIds: candidates.map((entity) => entity.id),
      entityType,
      scope,
    });
    const selected = candidates.filter(
      (entity) => entity.syncStatus !== 'synced' || !revisions.has(entity.id),
    );

    for (const entity of orderByHierarchy(selected)) {
      mutations.push({
        baseRevision: revisions.get(entity.id) ?? null,
        clientUpdatedAt: entity.clientUpdatedAt,
        entityId: entity.id,
        entityType,
        payload: entity as unknown as Record<string, unknown>,
      });
    }
  }

  return mutations;
}

async function applyPushResult(
  scope: AppScope,
  mutations: SyncMutation[],
  result: AccountOperationResult,
): Promise<void> {
  for (const mutation of mutations) {
    const mutationResult = result.mutations.find(
      (candidate) =>
        candidate.entityType === mutation.entityType &&
        candidate.id === mutation.entityId,
    );

    if (!mutationResult) {
      continue;
    }

    await getAccountEntityTable(mutation.entityType)
      .where(':id')
      .equals(mutation.entityId)
      .modify((entity) => {
        if (entity.scopeId !== scope.id) {
          return;
        }

        entity.remoteRevision = mutationResult.revision;

        if (entity.clientUpdatedAt === mutation.clientUpdatedAt) {
          entity.syncStatus = 'synced';
        }
      });
  }
}

async function pushBatch(
  scope: AppScope,
  mutations: SyncMutation[],
): Promise<void> {
  const result = await applyAccountOperationBatch({
    mutations: mutations.map((mutation) => ({
      baseRevision: mutation.baseRevision,
      entityType: mutation.entityType,
      payload: mutation.payload,
    })),
    operationId: createOperationId(),
    scope,
  });

  if (!result) {
    throw new Error('Account sync did not return a result.');
  }

  await applyPushResult(scope, mutations, result);
}

async function rebaseBatch(
  scope: AppScope,
  mutations: SyncMutation[],
): Promise<SyncMutation[]> {
  const rebased: SyncMutation[] = [];

  for (const entityType of accountEntityTypes) {
    const batchMutations = mutations.filter(
      (mutation) => mutation.entityType === entityType,
    );

    if (batchMutations.length === 0) {
      continue;
    }

    const revisions = await fetchRemoteEntityRevisions({
      entityIds: batchMutations.map((mutation) => mutation.entityId),
      entityType,
      scope,
    });

    for (const mutation of batchMutations) {
      rebased.push({
        ...mutation,
        baseRevision: revisions.get(mutation.entityId) ?? null,
      });
    }
  }

  return mutations.map(
    (mutation) =>
      rebased.find(
        (candidate) =>
          candidate.entityType === mutation.entityType &&
          candidate.entityId === mutation.entityId,
      ) ?? mutation,
  );
}

async function pushPendingAccountChanges(scope: AppScope): Promise<void> {
  const supersededOperationIds = (
    await db.syncOutbox.where('scopeId').equals(scope.id).toArray()
  ).map((item) => item.id);
  const mutations = await collectSyncMutations(scope);

  for (let offset = 0; offset < mutations.length; offset += SYNC_BATCH_SIZE) {
    const batch = mutations.slice(offset, offset + SYNC_BATCH_SIZE);

    try {
      await pushBatch(scope, batch);
    } catch (error) {
      if (!isStaleRevisionError(error)) {
        throw error;
      }

      await pushBatch(scope, await rebaseBatch(scope, batch));
    }
  }

  await db.syncOutbox.bulkDelete(supersededOperationIds);
}

export async function syncAccountFromThisDevice(
  scope: AppScope,
): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  await refreshAccountCache(scope);
  await pushPendingAccountChanges(scope);
}
