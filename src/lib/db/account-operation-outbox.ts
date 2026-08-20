import Dexie, { type Table, type Transaction } from 'dexie';
import type {
  AccountOperationOutboxItem,
  AccountOperationOutboxMutation,
  AppScope,
  SyncEntityType,
} from '@/lib/domain';
import { applyAccountOperationBatch } from '@/lib/supabase/account-operations';
import { db } from './database';
import { createTimestamp } from './entity-metadata';

interface PersistedAccountEntity {
  id: string;
  scopeId: string;
  clientUpdatedAt: string;
  remoteRevision: number | null;
  syncStatus: 'local' | 'pending' | 'syncing' | 'synced' | 'failed';
}

type AccountOperationBatchResult = NonNullable<
  Awaited<ReturnType<typeof applyAccountOperationBatch>>
>;

const transactionBatches = new WeakMap<
  Transaction,
  AccountOperationOutboxItem[]
>();
const registeredTransactionScopes = new WeakMap<Transaction, Set<string>>();
const operationQueues = new Map<string, Promise<void>>();

function getAccountEntityTable(entityType: SyncEntityType) {
  if (entityType === 'categoryTag') {
    return db.categoryTags as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'dailyEntry') {
    return db.dailyEntries as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'checklistItem') {
    return db.checklistItems as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'goalGroup') {
    return db.goalGroups as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'goal') {
    return db.goals as Table<PersistedAccountEntity, string>;
  }

  return db.goalSteps as Table<PersistedAccountEntity, string>;
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const values = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  values[6] = (values[6] & 0x0f) | 0x40;
  values[8] = (values[8] & 0x3f) | 0x80;
  const hex = values.map((value) => value.toString(16).padStart(2, '0'));

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function createOutboxItem(scope: AppScope): AccountOperationOutboxItem {
  return {
    id: createOperationId(),
    scopeId: scope.id,
    mutations: [],
    createdAt: createTimestamp(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    status: 'pending',
  };
}

function enqueueOperation(
  scopeId: string,
  task: () => Promise<void>,
): Promise<void> {
  const previousTask = operationQueues.get(scopeId) ?? Promise.resolve();
  const nextTask = previousTask
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (operationQueues.get(scopeId) === nextTask) {
        operationQueues.delete(scopeId);
      }
    });

  operationQueues.set(scopeId, nextTask);

  return nextTask;
}

function registerTransactionDrain(
  transaction: Transaction,
  scope: AppScope,
): void {
  const registeredScopes =
    registeredTransactionScopes.get(transaction) ?? new Set<string>();

  if (registeredScopes.has(scope.id)) {
    return;
  }

  registeredScopes.add(scope.id);
  registeredTransactionScopes.set(transaction, registeredScopes);
  transaction.on('complete', () => {
    void resumeAccountOperationOutbox(scope).catch((error) => {
      console.error('Failed to resume Tick account operation outbox.', error);
    });
  });
}

async function appendMutation(
  transaction: Transaction,
  scope: AppScope,
  mutation: AccountOperationOutboxMutation,
): Promise<void> {
  if (!transaction.storeNames.includes(db.syncOutbox.name)) {
    throw new Error(
      'Account operation outbox is missing from the transaction.',
    );
  }

  const batches = transactionBatches.get(transaction) ?? [];
  let batch = batches.at(-1);
  const existingMutationIndex = batch?.mutations.findIndex(
    (candidate) =>
      candidate.entityType === mutation.entityType &&
      candidate.entityId === mutation.entityId,
  );

  if (
    batch &&
    existingMutationIndex !== undefined &&
    existingMutationIndex >= 0
  ) {
    const existingMutation = batch.mutations[existingMutationIndex];
    batch.mutations[existingMutationIndex] = {
      ...mutation,
      baseRevision: existingMutation.baseRevision,
    };
  } else {
    if (!batch || batch.mutations.length >= 100) {
      batch = createOutboxItem(scope);
      batches.push(batch);
      transactionBatches.set(transaction, batches);
    }

    batch.mutations.push(mutation);
  }

  await db.syncOutbox.put(batch);
  registerTransactionDrain(transaction, scope);
}

export async function persistAccountOperationMutation({
  baseRevision,
  clientUpdatedAt,
  entityId,
  entityType,
  operation,
  payload,
  scope,
}: AccountOperationOutboxMutation & { scope: AppScope }): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  const mutation: AccountOperationOutboxMutation = {
    baseRevision,
    clientUpdatedAt,
    entityId,
    entityType,
    operation,
    payload,
  };
  const transaction = Dexie.currentTransaction;

  if (transaction) {
    await appendMutation(transaction, scope, mutation);
    return;
  }

  await db.transaction('rw', db.syncOutbox, async () => {
    const standaloneTransaction = Dexie.currentTransaction;

    if (!standaloneTransaction) {
      throw new Error('Account operation outbox transaction is unavailable.');
    }

    await appendMutation(standaloneTransaction, scope, mutation);
  });
}

async function updateMutationEntityStatus(
  mutation: AccountOperationOutboxMutation,
  status: PersistedAccountEntity['syncStatus'],
): Promise<void> {
  await getAccountEntityTable(mutation.entityType)
    .where(':id')
    .equals(mutation.entityId)
    .modify((entity) => {
      if (entity.clientUpdatedAt === mutation.clientUpdatedAt) {
        entity.syncStatus = status;
      }
    });
}

async function markOperationSyncing(
  item: AccountOperationOutboxItem,
): Promise<AccountOperationOutboxItem | null> {
  return db.transaction(
    'rw',
    [
      db.syncOutbox,
      db.categoryTags,
      db.dailyEntries,
      db.checklistItems,
      db.goalGroups,
      db.goals,
      db.goalSteps,
    ],
    async () => {
      const current = await db.syncOutbox.get(item.id);

      if (!current || current.scopeId !== item.scopeId) {
        return null;
      }

      const syncingItem: AccountOperationOutboxItem = {
        ...current,
        attempts: current.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
        status: 'syncing',
      };
      await db.syncOutbox.put(syncingItem);

      for (const mutation of syncingItem.mutations) {
        await updateMutationEntityStatus(mutation, 'syncing');
      }

      return syncingItem;
    },
  );
}

function getSafeErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code.slice(0, 80);
  }

  return 'account_operation_failed';
}

async function markOperationFailed(
  item: AccountOperationOutboxItem,
  error: unknown,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.syncOutbox,
      db.categoryTags,
      db.dailyEntries,
      db.checklistItems,
      db.goalGroups,
      db.goals,
      db.goalSteps,
    ],
    async () => {
      const current = await db.syncOutbox.get(item.id);

      if (!current || current.scopeId !== item.scopeId) {
        return;
      }

      await db.syncOutbox.put({
        ...current,
        lastError: getSafeErrorCode(error),
        status: 'failed',
      });

      for (const mutation of current.mutations) {
        await updateMutationEntityStatus(mutation, 'failed');
      }
    },
  );
}

function validateOperationResult(
  item: AccountOperationOutboxItem,
  result: AccountOperationBatchResult,
): void {
  if (
    result.operationId !== item.id ||
    result.mutations.length !== item.mutations.length
  ) {
    throw new Error(
      'Account operation result does not match the local outbox.',
    );
  }
}

async function completeMutation(
  item: AccountOperationOutboxItem,
  mutation: AccountOperationOutboxMutation,
  result: AccountOperationBatchResult,
  futureItems: AccountOperationOutboxItem[],
): Promise<void> {
  const mutationResult = result.mutations.find(
    (candidate) =>
      candidate.entityType === mutation.entityType &&
      candidate.id === mutation.entityId,
  );

  if (!mutationResult) {
    throw new Error('Account operation result is missing a mutation.');
  }

  await getAccountEntityTable(mutation.entityType)
    .where(':id')
    .equals(mutation.entityId)
    .modify((entity) => {
      if (entity.scopeId !== item.scopeId) {
        return;
      }

      entity.remoteRevision = mutationResult.revision;

      if (entity.clientUpdatedAt === mutation.clientUpdatedAt) {
        entity.syncStatus = 'synced';
      }
    });

  const nextItem = futureItems.find((candidate) =>
    candidate.mutations.some(
      (candidateMutation) =>
        candidateMutation.entityType === mutation.entityType &&
        candidateMutation.entityId === mutation.entityId,
    ),
  );

  if (!nextItem) {
    return;
  }

  nextItem.mutations = nextItem.mutations.map((candidateMutation) =>
    candidateMutation.entityType === mutation.entityType &&
    candidateMutation.entityId === mutation.entityId
      ? { ...candidateMutation, baseRevision: mutationResult.revision }
      : candidateMutation,
  );
  await db.syncOutbox.put(nextItem);
}

async function completeOperation(
  item: AccountOperationOutboxItem,
  result: AccountOperationBatchResult,
): Promise<void> {
  validateOperationResult(item, result);

  await db.transaction(
    'rw',
    [
      db.syncOutbox,
      db.categoryTags,
      db.dailyEntries,
      db.checklistItems,
      db.goalGroups,
      db.goals,
      db.goalSteps,
    ],
    async () => {
      const futureItems = (
        await db.syncOutbox.where('scopeId').equals(item.scopeId).toArray()
      )
        .filter((candidate) => candidate.id !== item.id)
        .sort(
          (first, second) =>
            first.createdAt.localeCompare(second.createdAt) ||
            first.id.localeCompare(second.id),
        );

      for (const mutation of item.mutations) {
        await completeMutation(item, mutation, result, futureItems);
      }

      await db.syncOutbox.delete(item.id);
    },
  );
}

async function processOperation(
  scope: AppScope,
  item: AccountOperationOutboxItem,
): Promise<void> {
  const syncingItem = await markOperationSyncing(item);

  if (!syncingItem) {
    return;
  }

  try {
    const result = await applyAccountOperationBatch({
      mutations: syncingItem.mutations.map((mutation) => ({
        baseRevision: mutation.baseRevision,
        entityType: mutation.entityType,
        payload: mutation.payload,
      })),
      operationId: syncingItem.id,
      scope,
    });

    if (!result) {
      throw new Error('Account operation did not return a result.');
    }

    await completeOperation(syncingItem, result);
  } catch (error) {
    console.error('Failed to persist Tick account operation.', error);
    await markOperationFailed(syncingItem, error);
  }
}

async function drainOperations(
  scope: AppScope,
  includeFailed: boolean,
): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  const items = (
    await db.syncOutbox.where('scopeId').equals(scope.id).toArray()
  ).sort(
    (first, second) =>
      first.createdAt.localeCompare(second.createdAt) ||
      first.id.localeCompare(second.id),
  );

  for (const item of items) {
    if (item.status === 'failed' && !includeFailed) {
      break;
    }

    if (
      item.status !== 'pending' &&
      item.status !== 'syncing' &&
      item.status !== 'failed'
    ) {
      continue;
    }

    await processOperation(scope, item);
    const remainingItem = await db.syncOutbox.get(item.id);

    if (remainingItem?.status === 'failed') {
      break;
    }
  }
}

export async function getAccountOperationOutboxSummary(
  scopeId: string,
): Promise<{
  failedCount: number;
  pendingCount: number;
  syncingCount: number;
}> {
  const items = await db.syncOutbox.where('scopeId').equals(scopeId).toArray();
  const failed = new Set<string>();
  const pending = new Set<string>();
  const syncing = new Set<string>();

  for (const item of items) {
    for (const mutation of item.mutations) {
      const key = `${mutation.entityType}:${mutation.entityId}`;

      if (item.status === 'failed') {
        failed.add(key);
      } else if (item.status === 'syncing') {
        syncing.add(key);
      } else if (item.status === 'pending') {
        pending.add(key);
      }
    }
  }

  for (const key of failed) {
    syncing.delete(key);
    pending.delete(key);
  }

  for (const key of syncing) {
    pending.delete(key);
  }

  return {
    failedCount: failed.size,
    pendingCount: pending.size,
    syncingCount: syncing.size,
  };
}

export function resumeAccountOperationOutbox(scope: AppScope): Promise<void> {
  return enqueueOperation(scope.id, () => drainOperations(scope, false));
}

export async function retryFailedAccountOperationOutbox(
  scope: AppScope,
): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  await enqueueOperation(scope.id, () => drainOperations(scope, true));
}

export async function waitForAccountOperationOutbox(
  scopeId?: string,
): Promise<void> {
  if (scopeId) {
    while (operationQueues.has(scopeId)) {
      await operationQueues.get(scopeId);
    }
    return;
  }

  while (operationQueues.size > 0) {
    await Promise.all([...operationQueues.values()]);
  }
}
