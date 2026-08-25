import Dexie, { type Transaction } from 'dexie';
import type {
  AccountOperationOutboxItem,
  AccountOperationOutboxMutation,
  AppScope,
} from '@/lib/domain';
import { fetchRemoteEntityRevisions } from '@/lib/supabase/account-data';
import {
  applyAccountOperationBatch,
  isStaleRevisionError,
} from '@/lib/supabase/account-operations';
import { db } from './database';
import { createTimestamp } from './entity-metadata';
import {
  accountEntityTypes,
  createOperationId,
  getAccountEntityTable,
  type PersistedAccountEntity,
} from './account-entity-tables';
import {
  recordAccountOperationConfirmed,
  recordAccountOperationConflict,
  recordAccountOperationExhausted,
  recordAccountOperationRejected,
  recordAccountOperationSent,
} from './account-sync-metrics';

const MAX_AUTOMATIC_ATTEMPTS = 5;
const MAX_MUTATIONS_PER_OPERATION = 100;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;

export const MAX_ACCOUNT_OUTBOX_OPERATIONS = 200;

type AccountOperationBatchResult = NonNullable<
  Awaited<ReturnType<typeof applyAccountOperationBatch>>
>;

const transactionBatches = new WeakMap<
  Transaction,
  AccountOperationOutboxItem[]
>();
const registeredTransactionScopes = new WeakMap<Transaction, Set<string>>();
const operationQueues = new Map<string, Promise<void>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function createOutboxItem(scope: AppScope): AccountOperationOutboxItem {
  return {
    id: createOperationId(),
    scopeId: scope.id,
    mutations: [],
    createdAt: createTimestamp(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    nextAttemptAt: null,
    rebasedAt: null,
    status: 'pending',
  };
}

export function computeAccountOperationRetryDelayMs(attempts: number): number {
  const exponent = Math.max(attempts - 1, 0);

  return Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS);
}

function isRetryDue(item: AccountOperationOutboxItem): boolean {
  if (!item.nextAttemptAt) {
    return true;
  }

  const nextAttempt = Date.parse(item.nextAttemptAt);

  return !Number.isFinite(nextAttempt) || nextAttempt <= Date.now();
}

function cancelScheduledRetry(scopeId: string): void {
  const timer = retryTimers.get(scopeId);

  if (timer === undefined) {
    return;
  }

  clearTimeout(timer);
  retryTimers.delete(scopeId);
}

function scheduleRetry(scope: AppScope, delayMs: number): void {
  cancelScheduledRetry(scope.id);

  const timer = setTimeout(() => {
    retryTimers.delete(scope.id);
    void enqueueOperation(scope.id, () =>
      withOutboxLock(scope.id, () =>
        drainOperations(scope, { ignoreBackoff: false, includeFailed: true }),
      ),
    ).catch((error) => {
      console.error('Failed to retry Tick account operations.', error);
    });
  }, delayMs);

  retryTimers.set(scope.id, timer);
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

async function hasReachedQueueLimit(scope: AppScope): Promise<boolean> {
  const queuedOperations = await db.syncOutbox
    .where('scopeId')
    .equals(scope.id)
    .count();

  return queuedOperations >= MAX_ACCOUNT_OUTBOX_OPERATIONS;
}

function registerOverflowFailure(
  transaction: Transaction,
  mutation: AccountOperationOutboxMutation,
): void {
  transaction.on('complete', () => {
    void updateMutationEntityStatus(mutation, 'failed').catch((error) => {
      console.error(
        'Failed to flag a Tick account change blocked by the outbox limit.',
        error,
      );
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
    if (!batch || batch.mutations.length >= MAX_MUTATIONS_PER_OPERATION) {
      if (await hasReachedQueueLimit(scope)) {
        registerOverflowFailure(transaction, mutation);
        return;
      }

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
        nextAttemptAt: null,
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
  scope: AppScope,
  item: AccountOperationOutboxItem,
  error: unknown,
): Promise<void> {
  const errorCode = getSafeErrorCode(error);
  const canRetryAutomatically = item.attempts < MAX_AUTOMATIC_ATTEMPTS;
  const retryDelayMs = computeAccountOperationRetryDelayMs(item.attempts);

  recordAccountOperationRejected(scope.id, errorCode);

  if (!canRetryAutomatically) {
    recordAccountOperationExhausted(scope.id);
  }

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
        lastError: errorCode,
        nextAttemptAt: canRetryAutomatically
          ? new Date(Date.now() + retryDelayMs).toISOString()
          : null,
        status: 'failed',
      });

      for (const mutation of current.mutations) {
        await updateMutationEntityStatus(mutation, 'failed');
      }
    },
  );

  if (canRetryAutomatically) {
    scheduleRetry(scope, retryDelayMs);
  }
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

async function sendOperation(
  scope: AppScope,
  item: AccountOperationOutboxItem,
): Promise<void> {
  recordAccountOperationSent(scope.id);

  const result = await applyAccountOperationBatch({
    mutations: item.mutations.map((mutation) => ({
      baseRevision: mutation.baseRevision,
      entityType: mutation.entityType,
      payload: mutation.payload,
    })),
    operationId: item.id,
    scope,
  });

  if (!result) {
    throw new Error('Account operation did not return a result.');
  }

  await completeOperation(item, result);
  recordAccountOperationConfirmed(
    scope.id,
    Date.now() - Date.parse(item.createdAt),
  );
}

async function rebaseStaleOperation(
  scope: AppScope,
  item: AccountOperationOutboxItem,
): Promise<AccountOperationOutboxItem> {
  const revisions = new Map<string, number>();

  for (const entityType of accountEntityTypes) {
    const entityIds = item.mutations
      .filter((mutation) => mutation.entityType === entityType)
      .map((mutation) => mutation.entityId);

    if (entityIds.length === 0) {
      continue;
    }

    const remoteRevisions = await fetchRemoteEntityRevisions({
      entityIds,
      entityType,
      scope,
    });

    for (const [entityId, revision] of remoteRevisions) {
      revisions.set(`${entityType}:${entityId}`, revision);
    }
  }

  const rebasedItem: AccountOperationOutboxItem = {
    ...item,
    mutations: item.mutations.map((mutation) => ({
      ...mutation,
      baseRevision:
        revisions.get(`${mutation.entityType}:${mutation.entityId}`) ?? null,
    })),
    rebasedAt: new Date().toISOString(),
  };

  await db.syncOutbox.put(rebasedItem);
  recordAccountOperationConflict(scope.id);

  return rebasedItem;
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
    await sendOperation(scope, syncingItem);
  } catch (error) {
    console.error('Failed to persist Tick account operation.', error);

    if (!isStaleRevisionError(error) || syncingItem.rebasedAt) {
      await markOperationFailed(scope, syncingItem, error);
      return;
    }

    try {
      await sendOperation(
        scope,
        await rebaseStaleOperation(scope, syncingItem),
      );
    } catch (rebaseError) {
      console.error(
        'Failed to reapply a stale Tick account operation.',
        rebaseError,
      );
      await markOperationFailed(scope, syncingItem, rebaseError);
    }
  }
}

function hasExhaustedAutomaticAttempts(
  item: AccountOperationOutboxItem,
): boolean {
  return item.status === 'failed' && item.attempts >= MAX_AUTOMATIC_ATTEMPTS;
}

async function withOutboxLock(
  scopeId: string,
  task: () => Promise<void>,
): Promise<void> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;

  if (!locks) {
    await task();
    return;
  }

  await locks.request(`tick-account-outbox:${scopeId}`, task);
}

async function drainOperations(
  scope: AppScope,
  {
    ignoreBackoff,
    includeFailed,
  }: { ignoreBackoff: boolean; includeFailed: boolean },
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

    if (hasExhaustedAutomaticAttempts(item)) {
      break;
    }

    if (!ignoreBackoff && !isRetryDue(item)) {
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

async function collectFailedEntityKeys(scopeId: string): Promise<Set<string>> {
  const keys = new Set<string>();

  for (const entityType of accountEntityTypes) {
    const entities = await getAccountEntityTable(entityType)
      .where('scopeId')
      .equals(scopeId)
      .filter((entity) => entity.syncStatus === 'failed')
      .toArray();

    for (const entity of entities) {
      keys.add(`${entityType}:${entity.id}`);
    }
  }

  return keys;
}

export async function getAccountOperationOutboxSummary(
  scopeId: string,
): Promise<{
  failedCount: number;
  pendingCount: number;
  syncingCount: number;
}> {
  const items = await db.syncOutbox.where('scopeId').equals(scopeId).toArray();
  const failed = await collectFailedEntityKeys(scopeId);
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
  return enqueueOperation(scope.id, () =>
    withOutboxLock(scope.id, () =>
      drainOperations(scope, { ignoreBackoff: false, includeFailed: false }),
    ),
  );
}

export async function retryFailedAccountOperationOutbox(
  scope: AppScope,
): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  cancelScheduledRetry(scope.id);

  await enqueueOperation(scope.id, () =>
    withOutboxLock(scope.id, () =>
      drainOperations(scope, { ignoreBackoff: true, includeFailed: true }),
    ),
  );
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
