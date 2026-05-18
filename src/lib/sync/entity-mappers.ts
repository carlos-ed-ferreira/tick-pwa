import type {
  AppScope,
  CategoryTag,
  ChecklistItem,
  DailyEntry,
  DailyEntryCategorySummary,
  Goal,
  GoalStep,
  SyncEntityType,
} from '@/lib/domain';

export type RemoteEntityTable =
  | 'category_tags'
  | 'daily_entries'
  | 'checklist_items'
  | 'goals'
  | 'goal_steps';

interface RemoteBaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_updated_at: string;
  revision: number;
}

export interface RemoteCategoryTag extends RemoteBaseRow {
  name: string;
  color_hex: string;
  position: string;
}

export interface RemoteDailyEntry extends RemoteBaseRow {
  date: string;
  timezone: string;
  title: string;
  note: string;
  preview_text: string;
  item_count: number;
  completed_count: number;
  category_tag_ids: string[];
  category_summaries: unknown;
}

export interface RemoteChecklistItem extends RemoteBaseRow {
  daily_entry_id: string;
  parent_id: string | null;
  text: string;
  checked: boolean;
  priority: boolean;
  collapsed: boolean;
  category_tag_id: string | null;
  sort_rank: string;
}

export interface RemoteGoal extends RemoteBaseRow {
  category: Goal['category'];
  title: string;
  description: string;
  status: Goal['status'];
  progress_mode: Goal['progressMode'];
  progress_value: number | string;
  due_date: string | null;
  category_tag_id: string | null;
  sort_rank: string;
  archived_at: string | null;
}

export interface RemoteGoalStep extends RemoteBaseRow {
  goal_id: string;
  parent_id: string | null;
  text: string;
  completed: boolean;
  collapsed: boolean;
  category_tag_id: string | null;
  sort_rank: string;
}

export type RemoteRow =
  | RemoteCategoryTag
  | RemoteDailyEntry
  | RemoteChecklistItem
  | RemoteGoal
  | RemoteGoalStep;

export function getRemoteTableName(
  entityType: SyncEntityType,
): RemoteEntityTable {
  if (entityType === 'categoryTag') {
    return 'category_tags';
  }

  if (entityType === 'dailyEntry') {
    return 'daily_entries';
  }

  if (entityType === 'checklistItem') {
    return 'checklist_items';
  }

  if (entityType === 'goal') {
    return 'goals';
  }

  return 'goal_steps';
}

function serializeBaseEntity(scope: AppScope, entity: RemoteLocalEntity) {
  return {
    id: entity.id,
    user_id: scope.ownerId,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    deleted_at: entity.deletedAt,
    client_updated_at: entity.clientUpdatedAt,
  };
}

type RemoteLocalEntity =
  | CategoryTag
  | DailyEntry
  | ChecklistItem
  | Goal
  | GoalStep;

function parseCategorySummaries(value: unknown): DailyEntryCategorySummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((summary) => {
    if (!summary || typeof summary !== 'object') {
      return [];
    }

    const record = summary as Record<string, unknown>;
    const categoryTagId = record.categoryTagId;
    const itemCount = record.itemCount;
    const completedCount = record.completedCount;

    if (
      typeof categoryTagId !== 'string' ||
      typeof itemCount !== 'number' ||
      typeof completedCount !== 'number'
    ) {
      return [];
    }

    return [{ categoryTagId, itemCount, completedCount }];
  });
}

export function toRemotePayload(
  scope: AppScope,
  entityType: SyncEntityType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (entityType === 'categoryTag') {
    const categoryTag = payload as unknown as CategoryTag;

    return {
      ...serializeBaseEntity(scope, categoryTag),
      name: categoryTag.name,
      color_hex: categoryTag.colorHex,
      position: categoryTag.position,
    };
  }

  if (entityType === 'dailyEntry') {
    const entry = payload as unknown as DailyEntry;

    return {
      ...serializeBaseEntity(scope, entry),
      date: entry.date,
      timezone: entry.timezone,
      title: entry.title,
      note: entry.note,
      preview_text: entry.previewText,
      item_count: entry.itemCount,
      completed_count: entry.completedCount,
      category_tag_ids: entry.categoryTagIds,
      category_summaries: entry.categorySummaries ?? [],
    };
  }

  if (entityType === 'checklistItem') {
    const item = payload as unknown as ChecklistItem;

    return {
      ...serializeBaseEntity(scope, item),
      daily_entry_id: item.dailyEntryId,
      parent_id: item.parentId,
      text: item.text,
      checked: item.checked,
      priority: item.priority,
      collapsed: item.collapsed,
      category_tag_id: item.categoryTagId,
      sort_rank: item.sortRank,
    };
  }

  if (entityType === 'goal') {
    const goal = payload as unknown as Goal;

    return {
      ...serializeBaseEntity(scope, goal),
      category: goal.category,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      progress_mode: goal.progressMode,
      progress_value: goal.progressValue,
      due_date: goal.dueDate,
      category_tag_id: goal.categoryTagId,
      sort_rank: goal.sortRank,
      archived_at: goal.archivedAt,
    };
  }

  const goalStep = payload as unknown as GoalStep;

  return {
    ...serializeBaseEntity(scope, goalStep),
    goal_id: goalStep.goalId,
    parent_id: goalStep.parentId,
    text: goalStep.text,
    completed: goalStep.completed,
    collapsed: goalStep.collapsed,
    category_tag_id: goalStep.categoryTagId,
    sort_rank: goalStep.sortRank,
  };
}

function baseFromRemote(scope: AppScope, row: RemoteBaseRow) {
  return {
    id: row.id,
    scopeId: scope.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: 'synced' as const,
    remoteRevision: row.revision,
    clientUpdatedAt: row.client_updated_at,
  };
}

export function categoryTagFromRemote(
  scope: AppScope,
  row: RemoteCategoryTag,
): CategoryTag {
  return {
    ...baseFromRemote(scope, row),
    name: row.name,
    colorHex: row.color_hex,
    position: row.position,
  };
}

export function dailyEntryFromRemote(
  scope: AppScope,
  row: RemoteDailyEntry,
): DailyEntry {
  return {
    ...baseFromRemote(scope, row),
    date: row.date as DailyEntry['date'],
    timezone: row.timezone,
    title: row.title,
    note: row.note,
    previewText: row.preview_text,
    itemCount: row.item_count,
    completedCount: row.completed_count,
    categoryTagIds: row.category_tag_ids,
    categorySummaries: parseCategorySummaries(row.category_summaries),
  };
}

export function checklistItemFromRemote(
  scope: AppScope,
  row: RemoteChecklistItem,
): ChecklistItem {
  return {
    ...baseFromRemote(scope, row),
    dailyEntryId: row.daily_entry_id,
    parentId: row.parent_id,
    text: row.text,
    checked: row.checked,
    priority: row.priority ?? false,
    collapsed: row.collapsed,
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
  };
}

export function goalFromRemote(scope: AppScope, row: RemoteGoal): Goal {
  return {
    ...baseFromRemote(scope, row),
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    progressMode: row.progress_mode,
    progressValue: Number(row.progress_value),
    dueDate: row.due_date as Goal['dueDate'],
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
    archivedAt: row.archived_at,
  };
}

export function goalStepFromRemote(
  scope: AppScope,
  row: RemoteGoalStep,
): GoalStep {
  return {
    ...baseFromRemote(scope, row),
    goalId: row.goal_id,
    parentId: row.parent_id,
    text: row.text,
    completed: row.completed,
    collapsed: row.collapsed,
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
  };
}
