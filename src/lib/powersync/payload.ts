export type PowerSyncPocTable =
  | 'powersync_poc_category_tags'
  | 'powersync_poc_daily_entries'
  | 'powersync_poc_checklist_items';

const powerSyncPocTables = new Set<string>([
  'powersync_poc_category_tags',
  'powersync_poc_daily_entries',
  'powersync_poc_checklist_items',
]);

export function isPowerSyncPocTable(table: string): table is PowerSyncPocTable {
  return powerSyncPocTables.has(table);
}

function normalizeBoolean(value: unknown, field: string): boolean {
  if (value === true || value === 1) {
    return true;
  }

  if (value === false || value === 0) {
    return false;
  }

  throw new Error(`Invalid PowerSync boolean value for ${field}.`);
}

function normalizeJson(value: unknown, field: string): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid PowerSync JSON value for ${field}.`);
  }
}

export function normalizePowerSyncPayload({
  payload,
  table,
  userId,
}: {
  table: PowerSyncPocTable;
  payload: Record<string, unknown>;
  userId: string;
}): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...payload, user_id: userId };

  if (table === 'powersync_poc_category_tags' && 'use_own_name' in normalized) {
    normalized.use_own_name = normalizeBoolean(
      normalized.use_own_name,
      'use_own_name',
    );
  }

  if (table === 'powersync_poc_daily_entries') {
    if ('category_tag_ids' in normalized) {
      normalized.category_tag_ids = normalizeJson(
        normalized.category_tag_ids,
        'category_tag_ids',
      );
    }

    if ('category_summaries' in normalized) {
      normalized.category_summaries = normalizeJson(
        normalized.category_summaries,
        'category_summaries',
      );
    }
  }

  if (table === 'powersync_poc_checklist_items') {
    for (const field of [
      'bold',
      'checked',
      'collapsed',
      'ignored',
      'priority',
    ]) {
      if (field in normalized) {
        normalized[field] = normalizeBoolean(normalized[field], field);
      }
    }
  }

  return normalized;
}
