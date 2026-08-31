import { db } from './database';

export interface AccountSyncMetrics {
  batchesConfirmed: number;
  batchesRejected: number;
  batchesSent: number;
  conflicts: number;
  definitiveFailures: number;
  lastBatchDurationMs: number | null;
  lastBatchMutationCount: number | null;
  lastBatchResult: 'confirmed' | 'rejected' | 'transport_unavailable' | null;
  lastConfirmationLatencyMs: number | null;
  lastErrorCode: string | null;
  maxConfirmationLatencyMs: number | null;
  maxBatchDurationMs: number | null;
  maxBatchMutationCount: number;
  oldestOperationAgeMs: number | null;
  queuedMutations: number;
  queuedOperations: number;
  transportFailures: number;
}

type AccountSyncCounters = Pick<
  AccountSyncMetrics,
  | 'batchesConfirmed'
  | 'batchesRejected'
  | 'batchesSent'
  | 'conflicts'
  | 'definitiveFailures'
  | 'lastBatchDurationMs'
  | 'lastBatchMutationCount'
  | 'lastBatchResult'
  | 'lastConfirmationLatencyMs'
  | 'lastErrorCode'
  | 'maxConfirmationLatencyMs'
  | 'maxBatchDurationMs'
  | 'maxBatchMutationCount'
  | 'transportFailures'
>;

const countersByScope = new Map<string, AccountSyncCounters>();

function createCounters(): AccountSyncCounters {
  return {
    batchesConfirmed: 0,
    batchesRejected: 0,
    batchesSent: 0,
    conflicts: 0,
    definitiveFailures: 0,
    lastBatchDurationMs: null,
    lastBatchMutationCount: null,
    lastBatchResult: null,
    lastConfirmationLatencyMs: null,
    lastErrorCode: null,
    maxConfirmationLatencyMs: null,
    maxBatchDurationMs: null,
    maxBatchMutationCount: 0,
    transportFailures: 0,
  };
}

function getCounters(scopeId: string): AccountSyncCounters {
  const counters = countersByScope.get(scopeId) ?? createCounters();
  countersByScope.set(scopeId, counters);

  return counters;
}

export function recordAccountOperationSent(
  scopeId: string,
  mutationCount: number,
): void {
  const counters = getCounters(scopeId);

  counters.batchesSent += 1;
  counters.lastBatchMutationCount = mutationCount;
  counters.maxBatchMutationCount = Math.max(
    counters.maxBatchMutationCount,
    mutationCount,
  );
}

function recordBatchResult(
  scopeId: string,
  result: NonNullable<AccountSyncMetrics['lastBatchResult']>,
  durationMs: number,
): void {
  const counters = getCounters(scopeId);
  const boundedDuration = Math.max(durationMs, 0);

  counters.lastBatchDurationMs = boundedDuration;
  counters.lastBatchResult = result;
  counters.maxBatchDurationMs = Math.max(
    counters.maxBatchDurationMs ?? 0,
    boundedDuration,
  );
}

export function recordAccountOperationConfirmed(
  scopeId: string,
  latencyMs: number,
  durationMs: number,
): void {
  const counters = getCounters(scopeId);
  const boundedLatency = Math.max(latencyMs, 0);

  counters.batchesConfirmed += 1;
  counters.lastConfirmationLatencyMs = boundedLatency;
  counters.maxConfirmationLatencyMs = Math.max(
    counters.maxConfirmationLatencyMs ?? 0,
    boundedLatency,
  );
  recordBatchResult(scopeId, 'confirmed', durationMs);
}

export function recordAccountOperationRejected(
  scopeId: string,
  errorCode: string,
  durationMs: number,
): void {
  const counters = getCounters(scopeId);

  counters.batchesRejected += 1;
  counters.lastErrorCode = errorCode;
  recordBatchResult(scopeId, 'rejected', durationMs);
}

export function recordAccountOperationTransportUnavailable(
  scopeId: string,
  durationMs: number,
): void {
  getCounters(scopeId).transportFailures += 1;
  recordBatchResult(scopeId, 'transport_unavailable', durationMs);
}

export function recordAccountOperationConflict(scopeId: string): void {
  getCounters(scopeId).conflicts += 1;
}

export function recordAccountOperationExhausted(scopeId: string): void {
  getCounters(scopeId).definitiveFailures += 1;
}

export async function getAccountSyncMetrics(
  scopeId: string,
): Promise<AccountSyncMetrics> {
  const items = await db.syncOutbox.where('scopeId').equals(scopeId).toArray();
  const now = Date.now();
  const oldestCreatedAt = items
    .map((item) => Date.parse(item.createdAt))
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((first, second) => first - second)
    .at(0);

  return {
    ...getCounters(scopeId),
    oldestOperationAgeMs:
      oldestCreatedAt === undefined ? null : Math.max(now - oldestCreatedAt, 0),
    queuedMutations: items.reduce(
      (total, item) => total + item.mutations.length,
      0,
    ),
    queuedOperations: items.length,
  };
}
