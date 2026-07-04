import Dexie from 'dexie';
import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db/database';
import { getSupabaseBrowserClient } from './client';
import {
  categoryTagFromRemote,
  checklistItemFromRemote,
  dailyEntryFromRemote,
  goalFromRemote,
  goalGroupFromRemote,
  goalStepFromRemote,
  type RemoteCategoryTag,
  type RemoteChecklistItem,
  type RemoteDailyEntry,
  type RemoteGoal,
  type RemoteGoalGroup,
  type RemoteGoalStep,
} from './entity-mappers';

interface CacheEntity {
  id: string;
  scopeId: string;
  syncStatus: 'local' | 'pending' | 'syncing' | 'synced' | 'failed';
}

interface SelectResponse<TRemote> {
  data: TRemote[] | null;
  error: {
    code?: string | null;
    details?: string | null;
    hint?: string | null;
    message?: string | null;
  } | null;
}

function isMissingTableError(
  error: SelectResponse<unknown>['error'],
  tableName: string,
) {
  return (
    error?.code === 'PGRST205' &&
    error.message?.includes(`'public.${tableName}'`) === true
  );
}

async function selectRemoteRows<TRemote>(
  tableName: string,
  {
    allowMissingTable = false,
  }: {
    allowMissingTable?: boolean;
  } = {},
): Promise<SelectResponse<TRemote>> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const response = (await client
    .from(tableName)
    .select('*')) as SelectResponse<TRemote>;

  if (allowMissingTable && isMissingTableError(response.error, tableName)) {
    return {
      data: [],
      error: null,
    };
  }

  return response;
}

async function mergeRemoteRows<TEntity extends CacheEntity, TRemote>({
  scope,
  rows,
  table,
  toLocal,
}: {
  scope: AppScope;
  rows: TRemote[];
  table: Dexie.Table<TEntity, string>;
  toLocal: (row: TRemote) => TEntity;
}) {
  const existingItems = await table.where('scopeId').equals(scope.id).toArray();
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const remoteIds = new Set<string>();

  for (const row of rows) {
    const localItem = toLocal(row);
    remoteIds.add(localItem.id);

    const existingItem = existingById.get(localItem.id);

    if (existingItem && existingItem.syncStatus !== 'synced') {
      continue;
    }

    await table.put(localItem);
  }

  for (const existingItem of existingItems) {
    if (
      existingItem.syncStatus === 'synced' &&
      !remoteIds.has(existingItem.id)
    ) {
      await table.delete(existingItem.id);
    }
  }
}

export async function refreshAccountCache(scope: AppScope): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  const [
    categoryTagsResponse,
    dailyEntriesResponse,
    checklistItemsResponse,
    goalGroupsResponse,
    goalsResponse,
    goalStepsResponse,
  ] = await Promise.all([
    selectRemoteRows<RemoteCategoryTag>('category_tags'),
    selectRemoteRows<RemoteDailyEntry>('daily_entries'),
    selectRemoteRows<RemoteChecklistItem>('checklist_items'),
    selectRemoteRows<RemoteGoalGroup>('goal_groups', {
      allowMissingTable: true,
    }),
    selectRemoteRows<RemoteGoal>('goals'),
    selectRemoteRows<RemoteGoalStep>('goal_steps'),
  ]);

  const firstError =
    categoryTagsResponse.error ??
    dailyEntriesResponse.error ??
    checklistItemsResponse.error ??
    goalGroupsResponse.error ??
    goalsResponse.error ??
    goalStepsResponse.error;

  if (firstError) {
    throw firstError;
  }

  await db.transaction(
    'rw',
    [
      db.categoryTags,
      db.dailyEntries,
      db.checklistItems,
      db.goalGroups,
      db.goals,
      db.goalSteps,
    ],
    async () => {
      await mergeRemoteRows({
        scope,
        table: db.categoryTags,
        rows: (categoryTagsResponse.data ?? []) as RemoteCategoryTag[],
        toLocal: (row) => categoryTagFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.dailyEntries,
        rows: (dailyEntriesResponse.data ?? []) as RemoteDailyEntry[],
        toLocal: (row) => dailyEntryFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.checklistItems,
        rows: (checklistItemsResponse.data ?? []) as RemoteChecklistItem[],
        toLocal: (row) => checklistItemFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.goalGroups,
        rows: (goalGroupsResponse.data ?? []) as RemoteGoalGroup[],
        toLocal: (row) => goalGroupFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.goals,
        rows: (goalsResponse.data ?? []) as RemoteGoal[],
        toLocal: (row) => goalFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.goalSteps,
        rows: (goalStepsResponse.data ?? []) as RemoteGoalStep[],
        toLocal: (row) => goalStepFromRemote(scope, row),
      });
    },
  );
}
