import type { AppScope, SyncEntityType } from '@/lib/domain';
import { fetchRemoteEntityRevisions } from '@/lib/supabase/account-data';
import {
  applyAccountOperationBatch,
  type AccountOperationResult,
} from '@/lib/supabase/account-operations';
import { db } from './database';
import {
  accountEntityTypes,
  createOperationId,
  getAccountEntityTable,
  type PersistedAccountEntity,
} from './account-entity-tables';

const FORCE_PUSH_BATCH_SIZE = 100;

interface ForcePushMutation {
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

async function collectForcePushMutations(
  scope: AppScope,
): Promise<ForcePushMutation[]> {
  const mutations: ForcePushMutation[] = [];

  for (const entityType of accountEntityTypes) {
    const entities = await getAccountEntityTable(entityType)
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    if (entities.length === 0) {
      continue;
    }

    const ordered = orderByHierarchy(entities);
    const revisions = await fetchRemoteEntityRevisions({
      entityIds: ordered.map((entity) => entity.id),
      entityType,
      scope,
    });

    for (const entity of ordered) {
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

async function applyForcePushResult(
  scope: AppScope,
  mutations: ForcePushMutation[],
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

function isStaleRevisionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('stale_revision')
  );
}

async function pushBatch(
  scope: AppScope,
  mutations: ForcePushMutation[],
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
    throw new Error('Account force push did not return a result.');
  }

  await applyForcePushResult(scope, mutations, result);
}

async function rebaseBatch(
  scope: AppScope,
  mutations: ForcePushMutation[],
): Promise<ForcePushMutation[]> {
  const rebased: ForcePushMutation[] = [];

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

export async function forcePushLocalAccountState(
  scope: AppScope,
): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  const supersededOperationIds = (
    await db.syncOutbox.where('scopeId').equals(scope.id).toArray()
  ).map((item) => item.id);
  const mutations = await collectForcePushMutations(scope);

  for (
    let offset = 0;
    offset < mutations.length;
    offset += FORCE_PUSH_BATCH_SIZE
  ) {
    const batch = mutations.slice(offset, offset + FORCE_PUSH_BATCH_SIZE);

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
