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
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  entityId: string;
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

  if (!data) {
    if (entityType === 'categoryTag') {
      await db.categoryTags.delete(entityId);
      return;
    }

    if (entityType === 'dailyEntry') {
      await db.dailyEntries.delete(entityId);
      return;
    }

    if (entityType === 'checklistItem') {
      await db.checklistItems.delete(entityId);
      return;
    }

    if (entityType === 'goal') {
      await db.goals.delete(entityId);
      return;
    }

    if (entityType === 'goalGroup') {
      await db.goalGroups.delete(entityId);
      return;
    }

    await db.goalSteps.delete(entityId);
    return;
  }

  if (entityType === 'categoryTag') {
    await db.categoryTags.put(
      categoryTagFromRemote(scope, data as RemoteCategoryTag),
    );
    return;
  }

  if (entityType === 'dailyEntry') {
    await db.dailyEntries.put(
      dailyEntryFromRemote(scope, data as RemoteDailyEntry),
    );
    return;
  }

  if (entityType === 'checklistItem') {
    await db.checklistItems.put(
      checklistItemFromRemote(scope, data as RemoteChecklistItem),
    );
    return;
  }

  if (entityType === 'goal') {
    await db.goals.put(goalFromRemote(scope, data as RemoteGoal));
    return;
  }

  if (entityType === 'goalGroup') {
    await db.goalGroups.put(
      goalGroupFromRemote(scope, data as RemoteGoalGroup),
    );
    return;
  }

  await db.goalSteps.put(goalStepFromRemote(scope, data as RemoteGoalStep));
}
