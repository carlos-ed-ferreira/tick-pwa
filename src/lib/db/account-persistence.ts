import type { AppScope, SyncEntityType, SyncOperation } from '@/lib/domain';
import { persistAccountEntity } from '@/lib/supabase/account-data';
import { db } from './database';

async function markAccountEntityPersisted({
  entityId,
  entityType,
  revision,
}: {
  entityType: SyncEntityType;
  entityId: string;
  revision: number | null;
}): Promise<void> {
  const update = {
    remoteRevision: revision,
    syncStatus: 'synced' as const,
  };

  if (entityType === 'categoryTag') {
    await db.categoryTags.update(entityId, update);
    return;
  }

  if (entityType === 'dailyEntry') {
    await db.dailyEntries.update(entityId, update);
    return;
  }

  if (entityType === 'checklistItem') {
    await db.checklistItems.update(entityId, update);
    return;
  }

  if (entityType === 'goal') {
    await db.goals.update(entityId, update);
    return;
  }

  await db.goalSteps.update(entityId, update);
}

export async function persistAccountEntityChange({
  entityId,
  entityType,
  payload,
  scope,
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

  const revision = await persistAccountEntity({
    entityType,
    payload,
    scope,
  });

  await markAccountEntityPersisted({
    entityId,
    entityType,
    revision,
  });
}
