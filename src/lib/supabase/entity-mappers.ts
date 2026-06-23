import type {
  AppScope,
  CategoryTag,
  CategoryTagSurface,
  ChecklistItem,
  DailyEntry,
  DailyEntryCategorySummary,
  Goal,
  GoalGroup,
  GoalStep,
  SyncEntityType,
} from '@/lib/domain';

export type RemoteEntityTable =
  | 'category_tags'
  | 'daily_entries'
  | 'checklist_items'
  | 'goal_groups'
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
  surface: CategoryTagSurface;
}

export interface RemoteDailyEntry extends RemoteBaseRow {
  date: string;
  timezone: string;
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
  group_id: string | null;
  title: string;
  category_tag_id: string | null;
  sort_rank: string;
  completed_at: string | null;
}

export interface RemoteGoalGroup extends RemoteBaseRow {
  title: string;
  category_tag_id: string | null;
  sort_rank: string;
}

export interface RemoteGoalStep extends RemoteBaseRow {
  goal_id: string;
  parent_id: string | null;
  text: string;
  completed: boolean;
  priority: boolean;
  collapsed: boolean;
  category_tag_id: string | null;
  sort_rank: string;
}

export type RemoteRow =
  | RemoteCategoryTag
  | RemoteDailyEntry
  | RemoteChecklistItem
  | RemoteGoalGroup
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

  if (entityType === 'goalGroup') {
    return 'goal_groups';
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
  | GoalGroup
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
    const surface =
      categoryTag.surface === 'calendar'
        ? 'checklist_item'
        : categoryTag.surface === 'goals'
          ? 'goal'
          : categoryTag.surface;

    return {
      ...serializeBaseEntity(scope, categoryTag),
      name: categoryTag.name,
      color_hex: categoryTag.colorHex,
      position: categoryTag.position,
      surface,
    };
  }

  if (entityType === 'dailyEntry') {
    const entry = payload as unknown as DailyEntry;

    return {
      ...serializeBaseEntity(scope, entry),
      date: entry.date,
      timezone: entry.timezone,
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

  if (entityType === 'goalGroup') {
    const goalGroup = payload as unknown as GoalGroup;

    return {
      ...serializeBaseEntity(scope, goalGroup),
      title: goalGroup.title,
      category_tag_id: goalGroup.categoryTagId,
      sort_rank: goalGroup.sortRank,
    };
  }

  if (entityType === 'goal') {
    const goal = payload as unknown as Goal;

    return {
      ...serializeBaseEntity(scope, goal),
      group_id: goal.groupId,
      title: goal.title,
      category_tag_id: goal.categoryTagId,
      sort_rank: goal.sortRank,
      completed_at: goal.completedAt,
    };
  }

  const goalStep = payload as unknown as GoalStep;

  return {
    ...serializeBaseEntity(scope, goalStep),
    goal_id: goalStep.goalId,
    parent_id: goalStep.parentId,
    text: goalStep.text,
    completed: goalStep.completed,
    priority: goalStep.priority,
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
    surface: row.surface,
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
    title: '',
    note: '',
    previewText: '',
    itemCount: row.item_count,
    completedCount: row.completed_count,
    categoryTagIds: row.category_tag_ids,
    categorySummaries: parseCategorySummaries(row.category_summaries),
  };
}

export function goalGroupFromRemote(
  scope: AppScope,
  row: RemoteGoalGroup,
): GoalGroup {
  return {
    ...baseFromRemote(scope, row),
    title: row.title,
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
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
    groupId: row.group_id,
    completedAt: row.completed_at,
    category: 'now',
    title: row.title,
    description: '',
    status: row.completed_at ? 'completed' : 'active',
    progressMode: 'steps',
    progressValue: 0,
    dueDate: null,
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
    archivedAt: row.completed_at,
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
    priority: row.priority ?? false,
    collapsed: row.collapsed,
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
  };
}
