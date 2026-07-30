import type { AppScope, EntitySyncStatus, SyncMetadata } from '@/lib/domain';

let lastTimestampMilliseconds = 0;

export function getEntitySyncStatus(scope: AppScope): EntitySyncStatus {
  return scope.kind === 'guest' ? 'local' : 'pending';
}

export function createSyncMetadata(
  scope: AppScope,
  timestamp: string,
): SyncMetadata {
  return {
    syncStatus: getEntitySyncStatus(scope),
    remoteRevision: null,
    clientUpdatedAt: timestamp,
  };
}

export function createTimestamp(): string {
  const timestampMilliseconds = Math.max(
    Date.now(),
    lastTimestampMilliseconds + 1,
  );
  lastTimestampMilliseconds = timestampMilliseconds;

  return new Date(timestampMilliseconds).toISOString();
}
