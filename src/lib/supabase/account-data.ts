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
  recurrenceFromRemote,
  recurrenceResponseFromRemote,
  toRemotePayload,
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

interface RestorableEntity {
  clientUpdatedAt: string;
  id: string;
}

interface RestoreTarget {
  table: () => Table<RestorableEntity, string>;
  fromRemote: (scope: AppScope, row: never) => RestorableEntity;
}

function createRestoreTarget<TEntity extends RestorableEntity, TRow>(
  table: () => Table<TEntity, string>,
  fromRemote: (scope: AppScope, row: TRow) => TEntity,
): RestoreTarget {
  return {
    table: table as unknown as RestoreTarget['table'],
    fromRemote: fromRemote as RestoreTarget['fromRemote'],
  };
}

const restoreTargets: Record<SyncEntityType, RestoreTarget> = {
  categoryTag: createRestoreTarget(
    () => db.categoryTags,
    categoryTagFromRemote,
  ),
  dailyEntry: createRestoreTarget(() => db.dailyEntries, dailyEntryFromRemote),
  checklistItem: createRestoreTarget(
    () => db.checklistItems,
    checklistItemFromRemote,
  ),
  goal: createRestoreTarget(() => db.goals, goalFromRemote),
  goalGroup: createRestoreTarget(() => db.goalGroups, goalGroupFromRemote),
  goalStep: createRestoreTarget(() => db.goalSteps, goalStepFromRemote),
  recurrence: createRestoreTarget(() => db.recurrences, recurrenceFromRemote),
  recurrenceResponse: createRestoreTarget(
    () => db.recurrenceResponses,
    recurrenceResponseFromRemote,
  ),
};

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

  const target = restoreTargets[entityType];

  await replaceCurrentEntity(
    target.table(),
    data ? target.fromRemote(scope, data as never) : null,
  );
}

const REMOTE_REVISION_CHUNK_SIZE = 200;

export async function fetchRemoteEntityRevisions({
  entityIds,
  entityType,
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  entityIds: string[];
}): Promise<Map<string, number>> {
  const revisions = new Map<string, number>();

  if (scope.kind !== 'user' || entityIds.length === 0) {
    return revisions;
  }

  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const tableName = getRemoteTableName(entityType);

  for (
    let offset = 0;
    offset < entityIds.length;
    offset += REMOTE_REVISION_CHUNK_SIZE
  ) {
    const chunk = entityIds.slice(offset, offset + REMOTE_REVISION_CHUNK_SIZE);
    const { data, error } = await client
      .from(tableName)
      .select('id,revision')
      .eq('user_id', scope.ownerId)
      .in('id', chunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as Array<{ id: string; revision: number }>) {
      revisions.set(row.id, row.revision);
    }
  }

  return revisions;
}
