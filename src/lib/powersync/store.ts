import type {
  AppScope,
  CategoryTag,
  ChecklistItem,
  DailyEntry,
  SyncEntityType,
} from '@/lib/domain';
import {
  categoryTagFromRemote,
  checklistItemFromRemote,
  dailyEntryFromRemote,
  type RemoteCategoryTag,
  type RemoteChecklistItem,
  type RemoteDailyEntry,
} from '@/lib/supabase/entity-mappers';
import { createPowerSyncPocMutation } from './mutation';
import { normalizePowerSyncPayload, type PowerSyncPocTable } from './payload';

interface PowerSyncPocStoreDatabase {
  execute: (sql: string, parameters?: unknown[]) => Promise<unknown>;
  getAll: (
    sql: string,
    parameters?: unknown[],
  ) => Promise<Record<string, unknown>[]>;
  writeTransaction: (
    action: (transaction: {
      execute: (sql: string, parameters?: unknown[]) => Promise<unknown>;
    }) => Promise<void>,
  ) => Promise<void>;
}

export interface PowerSyncPocSnapshot {
  categoryTags: CategoryTag[];
  checklistItems: ChecklistItem[];
  dailyEntries: DailyEntry[];
}

export interface PowerSyncPocWrite {
  baseRevision: number | null;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
  scope: AppScope;
}

function normalizeOwnedRows(
  rows: Record<string, unknown>[],
  scope: AppScope,
  table: PowerSyncPocTable,
): Record<string, unknown>[] {
  return rows
    .filter((row) => row.user_id === scope.ownerId)
    .map((row) =>
      normalizePowerSyncPayload({
        payload: row,
        table,
        userId: scope.ownerId,
      }),
    );
}

export class PowerSyncPocStore {
  constructor(private readonly database: PowerSyncPocStoreDatabase) {}

  async readSnapshot(scope: AppScope): Promise<PowerSyncPocSnapshot> {
    if (scope.kind === 'guest') {
      return { categoryTags: [], checklistItems: [], dailyEntries: [] };
    }

    const parameters = [scope.ownerId];
    const [categoryTagRows, dailyEntryRows, checklistItemRows] =
      await Promise.all([
        this.database.getAll(
          'SELECT * FROM powersync_poc_category_tags WHERE user_id = ?',
          parameters,
        ),
        this.database.getAll(
          'SELECT * FROM powersync_poc_daily_entries WHERE user_id = ?',
          parameters,
        ),
        this.database.getAll(
          'SELECT * FROM powersync_poc_checklist_items WHERE user_id = ?',
          parameters,
        ),
      ]);

    return {
      categoryTags: normalizeOwnedRows(
        categoryTagRows,
        scope,
        'powersync_poc_category_tags',
      ).map((row) =>
        categoryTagFromRemote(scope, row as unknown as RemoteCategoryTag),
      ),
      dailyEntries: normalizeOwnedRows(
        dailyEntryRows,
        scope,
        'powersync_poc_daily_entries',
      ).map((row) =>
        dailyEntryFromRemote(scope, row as unknown as RemoteDailyEntry),
      ),
      checklistItems: normalizeOwnedRows(
        checklistItemRows,
        scope,
        'powersync_poc_checklist_items',
      ).map((row) =>
        checklistItemFromRemote(scope, row as unknown as RemoteChecklistItem),
      ),
    };
  }

  async write({
    baseRevision,
    entityType,
    payload,
    scope,
  }: PowerSyncPocWrite): Promise<boolean> {
    const mutation = createPowerSyncPocMutation({
      baseRevision,
      entityType,
      payload,
      scope,
    });

    if (!mutation) {
      return false;
    }

    await this.database.execute(mutation.sql, mutation.parameters);
    return true;
  }

  async writeMany(changes: PowerSyncPocWrite[]): Promise<boolean> {
    if (changes.length === 0) {
      return true;
    }

    const scopeId = changes[0].scope.id;

    if (changes.some((change) => change.scope.id !== scopeId)) {
      throw new Error('PowerSync batch cannot cross account scopes.');
    }

    const mutations = changes.map((change) =>
      createPowerSyncPocMutation(change),
    );

    if (mutations.some((mutation) => mutation === null)) {
      return false;
    }

    await this.database.writeTransaction(async (transaction) => {
      for (const mutation of mutations) {
        if (mutation) {
          await transaction.execute(mutation.sql, mutation.parameters);
        }
      }
    });

    return true;
  }
}
