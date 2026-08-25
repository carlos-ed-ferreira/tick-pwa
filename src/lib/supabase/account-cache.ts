import Dexie from 'dexie';
import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db/database';
import { refreshAccountPreferences } from './account-preferences';
import { getSupabaseBrowserClient } from './client';
import {
  categoryTagFromRemote,
  checklistItemFromRemote,
  dailyEntryFromRemote,
  goalFromRemote,
  goalGroupFromRemote,
  goalStepFromRemote,
  type RemoteEntityTable,
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
  remoteRevision: number | null;
  syncStatus: 'local' | 'pending' | 'syncing' | 'synced' | 'failed';
}

function isSameRemoteRevision(
  existingItem: CacheEntity,
  remoteItem: CacheEntity,
): boolean {
  return (
    remoteItem.remoteRevision !== null &&
    existingItem.remoteRevision === remoteItem.remoteRevision
  );
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

interface SelectPageQuery<TRemote> {
  order: (
    column: string,
    options: { ascending: boolean },
  ) => SelectPageQuery<TRemote>;
  range: (from: number, to: number) => Promise<SelectResponse<TRemote>>;
}

export interface AccountCacheTableMetrics {
  pages: number;
  rows: number;
}

export interface AccountCacheRefreshResult {
  durationMs: number;
  tables: Record<RemoteEntityTable, AccountCacheTableMetrics>;
  totalPages: number;
  totalRows: number;
}

interface CompleteRemoteSnapshot<TRemote> extends AccountCacheTableMetrics {
  data: TRemote[];
}

const ACCOUNT_CACHE_PAGE_SIZE = 1000;

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
  tableName: RemoteEntityTable,
  {
    allowMissingTable = false,
  }: {
    allowMissingTable?: boolean;
  } = {},
): Promise<CompleteRemoteSnapshot<TRemote>> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const rows: TRemote[] = [];
  let pages = 0;

  while (true) {
    const from = pages * ACCOUNT_CACHE_PAGE_SIZE;
    const query = client
      .from(tableName)
      .select('*') as unknown as SelectPageQuery<TRemote>;
    const response = await query
      .order('revision', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + ACCOUNT_CACHE_PAGE_SIZE - 1);

    pages += 1;

    if (allowMissingTable && isMissingTableError(response.error, tableName)) {
      return { data: [], pages, rows: 0 };
    }

    if (response.error) {
      throw response.error;
    }

    const pageRows = response.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < ACCOUNT_CACHE_PAGE_SIZE) {
      return { data: rows, pages, rows: rows.length };
    }
  }
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

    if (existingItem && isSameRemoteRevision(existingItem, localItem)) {
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

export async function refreshAccountCache(
  scope: AppScope,
): Promise<AccountCacheRefreshResult | null> {
  if (scope.kind !== 'user') {
    return null;
  }

  const startedAt = performance.now();

  const [
    ,
    categoryTagsResponse,
    dailyEntriesResponse,
    checklistItemsResponse,
    goalGroupsResponse,
    goalsResponse,
    goalStepsResponse,
  ] = await Promise.all([
    refreshAccountPreferences(scope),
    selectRemoteRows<RemoteCategoryTag>('category_tags'),
    selectRemoteRows<RemoteDailyEntry>('daily_entries'),
    selectRemoteRows<RemoteChecklistItem>('checklist_items'),
    selectRemoteRows<RemoteGoalGroup>('goal_groups', {
      allowMissingTable: true,
    }),
    selectRemoteRows<RemoteGoal>('goals'),
    selectRemoteRows<RemoteGoalStep>('goal_steps'),
  ]);

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
        rows: categoryTagsResponse.data,
        toLocal: (row) => categoryTagFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.dailyEntries,
        rows: dailyEntriesResponse.data,
        toLocal: (row) => dailyEntryFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.checklistItems,
        rows: checklistItemsResponse.data,
        toLocal: (row) => checklistItemFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.goalGroups,
        rows: goalGroupsResponse.data,
        toLocal: (row) => goalGroupFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.goals,
        rows: goalsResponse.data,
        toLocal: (row) => goalFromRemote(scope, row),
      });
      await mergeRemoteRows({
        scope,
        table: db.goalSteps,
        rows: goalStepsResponse.data,
        toLocal: (row) => goalStepFromRemote(scope, row),
      });
    },
  );

  const tables = {
    category_tags: {
      pages: categoryTagsResponse.pages,
      rows: categoryTagsResponse.rows,
    },
    daily_entries: {
      pages: dailyEntriesResponse.pages,
      rows: dailyEntriesResponse.rows,
    },
    checklist_items: {
      pages: checklistItemsResponse.pages,
      rows: checklistItemsResponse.rows,
    },
    goal_groups: {
      pages: goalGroupsResponse.pages,
      rows: goalGroupsResponse.rows,
    },
    goals: { pages: goalsResponse.pages, rows: goalsResponse.rows },
    goal_steps: {
      pages: goalStepsResponse.pages,
      rows: goalStepsResponse.rows,
    },
  } satisfies Record<RemoteEntityTable, AccountCacheTableMetrics>;
  const tableMetrics = Object.values(tables);

  return {
    durationMs: performance.now() - startedAt,
    tables,
    totalPages: tableMetrics.reduce((total, table) => total + table.pages, 0),
    totalRows: tableMetrics.reduce((total, table) => total + table.rows, 0),
  };
}
