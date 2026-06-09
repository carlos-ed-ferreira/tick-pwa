import type {
  AppScope,
  DailyEntry,
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

type SupabaseSyncClient = NonNullable<
  ReturnType<typeof getSupabaseBrowserClient>
>;
type SupabaseError = {
  code?: string;
  details?: string;
  message?: string;
};

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

function isDailyEntryDateConflict(error: SupabaseError | null): boolean {
  if (!error) {
    return false;
  }

  const message = `${error.code ?? ''} ${error.message ?? ''} ${
    error.details ?? ''
  }`.toLowerCase();

  return (
    (message.includes('23505') ||
      message.includes('duplicate key') ||
      message.includes('unique constraint')) &&
    (message.includes('daily_entries_user_id_date_idx') ||
      message.includes('user_id') ||
      message.includes('date'))
  );
}

function isCreateOnlyOutboxItem(item: SyncOutboxItem): boolean {
  return item.changedFields.length === 1 && item.changedFields[0] === 'created';
}

async function remapDailyEntryConflict({
  item,
  remoteEntry,
  scope,
}: {
  scope: AppScope;
  item: SyncOutboxItem;
  remoteEntry: RemoteDailyEntry;
}): Promise<void> {
  const oldDailyEntryId = item.entityId;
  const nextDailyEntry = dailyEntryFromRemote(scope, remoteEntry);

  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.syncOutbox,
    async () => {
      const localEntry = await db.dailyEntries.get(oldDailyEntryId);
      const existingRemoteLocalEntry =
        oldDailyEntryId === remoteEntry.id
          ? localEntry
          : await db.dailyEntries.get(remoteEntry.id);
      const canonicalEntry = existingRemoteLocalEntry ?? nextDailyEntry;

      await db.dailyEntries.put({
        ...canonicalEntry,
        ...nextDailyEntry,
        syncStatus: 'synced',
      });

      if (oldDailyEntryId !== remoteEntry.id) {
        await db.dailyEntries.delete(oldDailyEntryId);
      }

      for (const checklistItem of await db.checklistItems
        .where('scopeId')
        .equals(scope.id)
        .filter((candidate) => candidate.dailyEntryId === oldDailyEntryId)
        .toArray()) {
        await db.checklistItems.put({
          ...checklistItem,
          dailyEntryId: remoteEntry.id,
        });
      }

      for (const outboxItem of await db.syncOutbox
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (candidate) =>
            candidate.entityId === oldDailyEntryId ||
            (candidate.entityType === 'checklistItem' &&
              candidate.payload.dailyEntryId === oldDailyEntryId),
        )
        .toArray()) {
        if (outboxItem.entityType === 'dailyEntry') {
          await db.syncOutbox.put({
            ...outboxItem,
            entityId: remoteEntry.id,
            baseRevision: remoteEntry.revision,
            payload: {
              ...outboxItem.payload,
              id: remoteEntry.id,
              scopeId: scope.id,
              remoteRevision: remoteEntry.revision,
            },
            status:
              outboxItem.status === 'syncing' ? 'pending' : outboxItem.status,
          });
          continue;
        }

        await db.syncOutbox.put({
          ...outboxItem,
          payload: {
            ...outboxItem.payload,
            dailyEntryId: remoteEntry.id,
          },
        });
      }
    },
  );
}

async function resolveDailyEntryDateConflict({
  client,
  item,
  scope,
}: {
  scope: AppScope;
  item: SyncOutboxItem;
  client: SupabaseSyncClient;
}): Promise<RemoteDailyEntry | null> {
  const payload = item.payload as unknown as Partial<DailyEntry>;

  if (typeof payload.date !== 'string') {
    return null;
  }

  const { data, error } = await client
    .from('daily_entries')
    .select('*')
    .eq('user_id', scope.ownerId)
    .eq('date', payload.date)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const remoteEntry = data as RemoteDailyEntry;
  await remapDailyEntryConflict({ scope, item, remoteEntry });

  return remoteEntry;
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
    if (item.entityType === 'dailyEntry' && isDailyEntryDateConflict(error)) {
      const remoteEntry = await resolveDailyEntryDateConflict({
        client,
        item,
        scope,
      });

      if (remoteEntry) {
        if (isCreateOnlyOutboxItem(item)) {
          await markLocalEntitySynced({
            entityType: item.entityType,
            entityId: remoteEntry.id,
            revision: remoteEntry.revision,
          });
          await db.syncOutbox.update(item.id, {
            lastError: null,
            status: 'synced',
          });
          return;
        }

        const retryItem = await db.syncOutbox.get(item.id);

        if (retryItem) {
          await pushOutboxItem(scope, retryItem);
          return;
        }
      }
    }

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
    const currentItem = await db.syncOutbox.get(item.id);

    if (
      !currentItem ||
      (currentItem.status !== 'pending' && currentItem.status !== 'failed')
    ) {
      continue;
    }

    await pushOutboxItem(scope, currentItem);
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
