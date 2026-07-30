import type { Table } from 'dexie';
import type { AppScope, SyncEntityType } from '@/lib/domain';
import { db } from '@/lib/db/database';
import { getSupabaseBrowserClient } from './client';
import {
  categoryTagFromRemote,
  checklistItemFromRemote,
  dailyEntryFromRemote,
  getRemoteTableName,
  goalFromRemote,
  goalGroupFromRemote,
  goalStepFromRemote,
  toRemotePayload,
  type RemoteCategoryTag,
  type RemoteChecklistItem,
  type RemoteDailyEntry,
  type RemoteGoal,
  type RemoteGoalGroup,
  type RemoteGoalStep,
} from './entity-mappers';

export async function persistAccountEntity({
  entityType,
  payload,
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
}): Promise<number | null> {
  if (scope.kind !== 'user') {
    return null;
  }

  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const { data, error } = await client
    .from(getRemoteTableName(entityType))
    .upsert(toRemotePayload(scope, entityType, payload), {
      onConflict: 'id',
    })
    .select('revision')
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as { revision?: number } | null;

  return row?.revision ?? null;
}

export async function restoreAccountEntity({
  entityId,
  entityType,
  expectedClientUpdatedAt,
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  entityId: string;
  expectedClientUpdatedAt?: string;
}): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const { data, error } = await client
    .from(getRemoteTableName(entityType))
    .select('*')
    .eq('id', entityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  async function replaceCurrentEntity<
    TEntity extends { clientUpdatedAt: string; id: string },
  >(table: Table<TEntity, string>, restoredEntity: TEntity | null) {
    await db.transaction('rw', table, async () => {
      const currentEntity = await table.get(entityId);

      if (
        expectedClientUpdatedAt &&
        currentEntity?.clientUpdatedAt !== expectedClientUpdatedAt
      ) {
        return;
      }

      if (restoredEntity) {
        await table.put(restoredEntity);
      } else {
        await table.delete(entityId);
      }
    });
  }

  if (!data) {
    if (entityType === 'categoryTag') {
      await replaceCurrentEntity(db.categoryTags, null);
      return;
    }

    if (entityType === 'dailyEntry') {
      await replaceCurrentEntity(db.dailyEntries, null);
      return;
    }

    if (entityType === 'checklistItem') {
      await replaceCurrentEntity(db.checklistItems, null);
      return;
    }

    if (entityType === 'goal') {
      await replaceCurrentEntity(db.goals, null);
      return;
    }

    if (entityType === 'goalGroup') {
      await replaceCurrentEntity(db.goalGroups, null);
      return;
    }

    await replaceCurrentEntity(db.goalSteps, null);
    return;
  }

  if (entityType === 'categoryTag') {
    await replaceCurrentEntity(
      db.categoryTags,
      categoryTagFromRemote(scope, data as RemoteCategoryTag),
    );
    return;
  }

  if (entityType === 'dailyEntry') {
    await replaceCurrentEntity(
      db.dailyEntries,
      dailyEntryFromRemote(scope, data as RemoteDailyEntry),
    );
    return;
  }

  if (entityType === 'checklistItem') {
    await replaceCurrentEntity(
      db.checklistItems,
      checklistItemFromRemote(scope, data as RemoteChecklistItem),
    );
    return;
  }

  if (entityType === 'goal') {
    await replaceCurrentEntity(
      db.goals,
      goalFromRemote(scope, data as RemoteGoal),
    );
    return;
  }

  if (entityType === 'goalGroup') {
    await replaceCurrentEntity(
      db.goalGroups,
      goalGroupFromRemote(scope, data as RemoteGoalGroup),
    );
    return;
  }

  await replaceCurrentEntity(
    db.goalSteps,
    goalStepFromRemote(scope, data as RemoteGoalStep),
  );
}
