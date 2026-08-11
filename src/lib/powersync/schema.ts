import { column, Schema, Table } from '@powersync/web';

const categoryTags = new Table(
  {
    user_id: column.text,
    name: column.text,
    color_hex: column.text,
    surface: column.text,
    position: column.text,
    use_own_name: column.integer,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    client_updated_at: column.text,
    revision: column.integer,
  },
  { indexes: { user_surface_position: ['user_id', 'surface', 'position'] } },
);

const dailyEntries = new Table(
  {
    user_id: column.text,
    date: column.text,
    timezone: column.text,
    item_count: column.integer,
    completed_count: column.integer,
    category_tag_ids: column.text,
    category_summaries: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    client_updated_at: column.text,
    revision: column.integer,
  },
  { indexes: { user_date: ['user_id', 'date'] } },
);

const checklistItems = new Table(
  {
    user_id: column.text,
    daily_entry_id: column.text,
    parent_id: column.text,
    category_tag_id: column.text,
    text: column.text,
    scheduled_time: column.text,
    checked: column.integer,
    ignored: column.integer,
    bold: column.integer,
    priority: column.integer,
    collapsed: column.integer,
    sort_rank: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    client_updated_at: column.text,
    revision: column.integer,
  },
  {
    indexes: {
      entry_rank: ['user_id', 'daily_entry_id', 'sort_rank'],
      parent: ['user_id', 'parent_id'],
    },
  },
);

export const tickPowerSyncPocSchema = new Schema({
  category_tags: categoryTags,
  daily_entries: dailyEntries,
  checklist_items: checklistItems,
});

export type TickPowerSyncPocDatabase = (typeof tickPowerSyncPocSchema)['types'];
