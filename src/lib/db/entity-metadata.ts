import type { AppScope, EntitySyncStatus, SyncMetadata } from '@/lib/domain';

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
  return new Date().toISOString();
}
