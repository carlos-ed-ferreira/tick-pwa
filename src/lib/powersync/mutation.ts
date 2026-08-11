import type { AppScope, SyncEntityType } from '@/lib/domain';
import { toRemotePayload } from '@/lib/supabase/entity-mappers';
import type { PowerSyncPocTable } from './payload';

export interface PowerSyncPocMutation {
  parameters: unknown[];
  sql: string;
}

function getPowerSyncPocTable(
  entityType: SyncEntityType,
): PowerSyncPocTable | null {
  if (entityType === 'categoryTag') {
    return 'category_tags';
  }

  if (entityType === 'dailyEntry') {
    return 'daily_entries';
  }

  if (entityType === 'checklistItem') {
    return 'checklist_items';
  }

  return null;
}

function toPowerSyncSqliteValue(
  table: PowerSyncPocTable,
  column: string,
  value: unknown,
): unknown {
  const booleanColumns =
    table === 'category_tags'
      ? new Set(['use_own_name'])
      : new Set(['bold', 'checked', 'collapsed', 'ignored', 'priority']);

  if (booleanColumns.has(column)) {
    return value ? 1 : 0;
  }

  if (
    table === 'daily_entries' &&
    (column === 'category_tag_ids' || column === 'category_summaries')
  ) {
    return JSON.stringify(value);
  }

  return value;
}

function createInsertMutation(
  table: PowerSyncPocTable,
  payload: Record<string, unknown>,
): PowerSyncPocMutation {
  const columns = Object.keys(payload);
  const placeholders = columns.map(() => '?');

  return {
    parameters: columns.map((column) =>
      toPowerSyncSqliteValue(table, column, payload[column]),
    ),
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
  };
}

function createUpdateMutation(
  table: PowerSyncPocTable,
  payload: Record<string, unknown>,
): PowerSyncPocMutation {
  const columns = Object.keys(payload).filter(
    (column) => column !== 'id' && column !== 'user_id',
  );

  return {
    parameters: [
      ...columns.map((column) =>
        toPowerSyncSqliteValue(table, column, payload[column]),
      ),
      payload.id,
      payload.user_id,
    ],
    sql: `UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND user_id = ?`,
  };
}

export function createPowerSyncPocMutation({
  baseRevision,
  entityType,
  payload,
  scope,
}: {
  baseRevision: number | null;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
  scope: AppScope;
}): PowerSyncPocMutation | null {
  if (scope.kind === 'guest') {
    return null;
  }

  const table = getPowerSyncPocTable(entityType);

  if (!table) {
    throw new Error(`Unsupported PowerSync entity type: ${entityType}.`);
  }

  const remotePayload = toRemotePayload(scope, entityType, payload);

  return baseRevision === null
    ? createInsertMutation(table, remotePayload)
    : createUpdateMutation(table, remotePayload);
}
