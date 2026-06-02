import type { AppScope, SyncEntityType, SyncOperation } from '@/lib/domain';
import { createId } from '@/lib/domain';
import { db } from './database';

export async function queueSyncOutboxItem({
  scope,
  entityType,
  entityId,
  operation,
  payload,
  changedFields,
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

  const now = new Date().toISOString();

  await db.syncOutbox.add({
    id: createId(),
    scopeId: scope.id,
    entityType,
    entityId,
    operation,
    payload,
    changedFields,
    baseRevision,
    createdAt: now,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    status: 'pending',
  });
}
