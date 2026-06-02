import type {
  AppScope,
  EntitySyncStatus,
  SyncEntityType,
  SyncOutboxItem,
} from '@/lib/domain';
import { db } from '@/lib/db';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  categoryTagFromRemote,
  checklistItemFromRemote,
  dailyEntryFromRemote,
  getRemoteTableName,
  goalFromRemote,
  goalStepFromRemote,
  toRemotePayload,
  type RemoteCategoryTag,
  type RemoteChecklistItem,
  type RemoteDailyEntry,
  type RemoteGoal,
  type RemoteGoalStep,
} from './entity-mappers';

const pushOrder: SyncEntityType[] = [
  'categoryTag',
  'dailyEntry',
  'checklistItem',
  'goal',
  'goalStep',
];

function compareOutboxItems(
  firstItem: SyncOutboxItem,
  secondItem: SyncOutboxItem,
): number {
  const firstOrder = pushOrder.indexOf(firstItem.entityType);
  const secondOrder = pushOrder.indexOf(secondItem.entityType);

  if (firstOrder !== secondOrder) {
    return firstOrder - secondOrder;
  }

  return firstItem.createdAt.localeCompare(secondItem.createdAt);
}

async function getPendingOutboxItems(
  scope: AppScope,
): Promise<SyncOutboxItem[]> {
  const items = await db.syncOutbox
    .where('scopeId')
    .equals(scope.id)
    .filter((item) => item.status === 'pending' || item.status === 'failed')
    .toArray();

  return items.sort(compareOutboxItems);
}

async function markLocalEntitySynced({
  entityType,
  entityId,
  revision,
}: {
  entityType: SyncEntityType;
  entityId: string;
  revision: number | null;
}): Promise<void> {
  const update = {
    syncStatus: 'synced' as EntitySyncStatus,
    remoteRevision: revision,
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

async function pushOutboxItem(scope: AppScope, item: SyncOutboxItem) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const now = new Date().toISOString();
  const tableName = getRemoteTableName(item.entityType);

  await db.syncOutbox.update(item.id, {
    attempts: item.attempts + 1,
    lastAttemptAt: now,
    lastError: null,
    status: 'syncing',
  });

  const { data, error } = await client
    .from(tableName)
    .upsert(toRemotePayload(scope, item.entityType, item.payload), {
      onConflict: 'id',
    })
    .select('revision')
    .maybeSingle();

  if (error) {
    await db.syncOutbox.update(item.id, {
      lastError: error.message,
      status: 'failed',
    });
    return;
  }

  const syncedRow = data as { revision?: number } | null;

  await markLocalEntitySynced({
    entityType: item.entityType,
    entityId: item.entityId,
    revision: syncedRow?.revision ?? null,
  });
  await db.syncOutbox.update(item.id, {
    lastError: null,
    status: 'synced',
  });
}

export async function pushPendingChanges(scope: AppScope): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  const items = await getPendingOutboxItems(scope);

  for (const item of items) {
    await pushOutboxItem(scope, item);
  }
}

async function shouldKeepPendingLocalEntity({
  entityType,
  entityId,
  remoteClientUpdatedAt,
}: {
  entityType: SyncEntityType;
  entityId: string;
  remoteClientUpdatedAt: string;
}): Promise<boolean> {
  const entity =
    entityType === 'categoryTag'
      ? await db.categoryTags.get(entityId)
      : entityType === 'dailyEntry'
        ? await db.dailyEntries.get(entityId)
        : entityType === 'checklistItem'
          ? await db.checklistItems.get(entityId)
          : entityType === 'goal'
            ? await db.goals.get(entityId)
            : await db.goalSteps.get(entityId);

  return Boolean(
    entity &&
    entity.syncStatus !== 'synced' &&
    entity.clientUpdatedAt > remoteClientUpdatedAt,
  );
}

async function pullCategoryTags(scope: AppScope): Promise<void> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { data, error } = await client.from('category_tags').select('*');

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as RemoteCategoryTag[]) {
    if (
      await shouldKeepPendingLocalEntity({
        entityType: 'categoryTag',
        entityId: row.id,
        remoteClientUpdatedAt: row.client_updated_at,
      })
    ) {
      continue;
    }

    await db.categoryTags.put(categoryTagFromRemote(scope, row));
  }
}

async function pullDailyEntries(scope: AppScope): Promise<void> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { data, error } = await client.from('daily_entries').select('*');

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as RemoteDailyEntry[]) {
    if (
      await shouldKeepPendingLocalEntity({
        entityType: 'dailyEntry',
        entityId: row.id,
        remoteClientUpdatedAt: row.client_updated_at,
      })
    ) {
      continue;
    }

    await db.dailyEntries.put(dailyEntryFromRemote(scope, row));
  }
}

async function pullChecklistItems(scope: AppScope): Promise<void> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { data, error } = await client.from('checklist_items').select('*');

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as RemoteChecklistItem[]) {
    if (
      await shouldKeepPendingLocalEntity({
        entityType: 'checklistItem',
        entityId: row.id,
        remoteClientUpdatedAt: row.client_updated_at,
      })
    ) {
      continue;
    }

    await db.checklistItems.put(checklistItemFromRemote(scope, row));
  }
}

async function pullGoals(scope: AppScope): Promise<void> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { data, error } = await client.from('goals').select('*');

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as RemoteGoal[]) {
    if (
      await shouldKeepPendingLocalEntity({
        entityType: 'goal',
        entityId: row.id,
        remoteClientUpdatedAt: row.client_updated_at,
      })
    ) {
      continue;
    }

    await db.goals.put(goalFromRemote(scope, row));
  }
}

async function pullGoalSteps(scope: AppScope): Promise<void> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { data, error } = await client.from('goal_steps').select('*');

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as RemoteGoalStep[]) {
    if (
      await shouldKeepPendingLocalEntity({
        entityType: 'goalStep',
        entityId: row.id,
        remoteClientUpdatedAt: row.client_updated_at,
      })
    ) {
      continue;
    }

    await db.goalSteps.put(goalStepFromRemote(scope, row));
  }
}

export async function pullRemoteState(scope: AppScope): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  await pullCategoryTags(scope);
  await pullDailyEntries(scope);
  await pullChecklistItems(scope);
  await pullGoals(scope);
  await pullGoalSteps(scope);
}

export async function synchronizeScope(scope: AppScope): Promise<void> {
  if (scope.kind === 'guest') {
    return;
  }

  await pushPendingChanges(scope);
  await pullRemoteState(scope);
}
