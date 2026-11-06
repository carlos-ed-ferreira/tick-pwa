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
  Recurrence,
  RecurrenceResponse,
  SyncEntityType,
} from '@/lib/domain';
import { normalizeTaskCompletionValues } from '@/lib/domain';

export type RemoteEntityTable =
  | 'category_tags'
  | 'daily_entries'
  | 'checklist_items'
  | 'goal_groups'
  | 'goals'
  | 'goal_steps'
  | 'recurrences'
  | 'recurrence_responses';

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
  use_own_name: boolean;
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
  scheduled_time: string | null;
  checked: boolean;
  ignored: boolean;
  mark_level?: number | null;
  bold: boolean;
  priority: boolean;
  collapsed: boolean;
  category_tag_id: string | null;
  sort_rank: string;
}

export interface RemoteGoal extends RemoteBaseRow {
  group_id: string | null;
  title: string;
  due_date: string | null;
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
  ignored: boolean;
  mark_level?: number | null;
  bold: boolean;
  priority: boolean;
  collapsed: boolean;
  category_tag_id: string | null;
  scheduled_date: string | null;
  sort_rank: string;
}

export type RemoteRow =
  | RemoteCategoryTag
  | RemoteDailyEntry
  | RemoteChecklistItem
  | RemoteGoalGroup
  | RemoteGoal
  | RemoteGoalStep
  | RemoteRecurrence
  | RemoteRecurrenceResponse;

export interface RemoteRecurrence extends RemoteBaseRow {
  category_tag_id: string | null;
  text: string;
  bold: boolean;
  priority: boolean;
  children: unknown;
  schedule: unknown;
  content_history: unknown;
}

export interface RemoteRecurrenceResponse extends RemoteBaseRow {
  recurrence_id: string;
  date: string;
  item_id: string | null;
  status: string;
}

const remoteTableNames: Record<SyncEntityType, RemoteEntityTable> = {
  categoryTag: 'category_tags',
  dailyEntry: 'daily_entries',
  checklistItem: 'checklist_items',
  goalGroup: 'goal_groups',
  goal: 'goals',
  goalStep: 'goal_steps',
  recurrence: 'recurrences',
  recurrenceResponse: 'recurrence_responses',
};

export function getRemoteTableName(
  entityType: SyncEntityType,
): RemoteEntityTable {
  return remoteTableNames[entityType];
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
  | GoalStep
  | Recurrence
  | RecurrenceResponse;

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

type RemoteSerializer<TEntity> = (
  scope: AppScope,
  entity: TEntity,
) => Record<string, unknown>;

const serializeCategoryTag: RemoteSerializer<CategoryTag> = (
  scope,
  categoryTag,
) => {
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
    use_own_name: categoryTag.useOwnName,
  };
};

const serializeDailyEntry: RemoteSerializer<DailyEntry> = (scope, entry) => ({
  ...serializeBaseEntity(scope, entry),
  date: entry.date,
  timezone: entry.timezone,
  item_count: entry.itemCount,
  completed_count: entry.completedCount,
  category_tag_ids: entry.categoryTagIds,
  category_summaries: entry.categorySummaries ?? [],
});

const serializeChecklistItem: RemoteSerializer<ChecklistItem> = (
  scope,
  item,
) => ({
  ...serializeBaseEntity(scope, item),
  daily_entry_id: item.dailyEntryId,
  parent_id: item.parentId,
  text: item.text,
  scheduled_time: item.scheduledTime,
  checked: item.checked,
  ignored: item.ignored,
  mark_level: item.markLevel,
  bold: item.bold,
  priority: item.priority,
  collapsed: item.collapsed,
  category_tag_id: item.categoryTagId,
  sort_rank: item.sortRank,
});

const serializeGoalGroup: RemoteSerializer<GoalGroup> = (scope, goalGroup) => ({
  ...serializeBaseEntity(scope, goalGroup),
  title: goalGroup.title,
  category_tag_id: goalGroup.categoryTagId,
  sort_rank: goalGroup.sortRank,
});

const serializeGoal: RemoteSerializer<Goal> = (scope, goal) => ({
  ...serializeBaseEntity(scope, goal),
  group_id: goal.groupId,
  title: goal.title,
  due_date: goal.dueDate,
  category_tag_id: goal.categoryTagId,
  sort_rank: goal.sortRank,
  completed_at: goal.completedAt,
});

const serializeGoalStep: RemoteSerializer<GoalStep> = (scope, goalStep) => ({
  ...serializeBaseEntity(scope, goalStep),
  goal_id: goalStep.goalId,
  parent_id: goalStep.parentId,
  text: goalStep.text,
  completed: goalStep.completed,
  ignored: goalStep.ignored,
  mark_level: goalStep.markLevel,
  bold: goalStep.bold,
  priority: goalStep.priority,
  collapsed: goalStep.collapsed,
  category_tag_id: goalStep.categoryTagId,
  scheduled_date: goalStep.scheduledDate,
  sort_rank: goalStep.sortRank,
});

const serializeRecurrence: RemoteSerializer<Recurrence> = (
  scope,
  recurrence,
) => ({
  ...serializeBaseEntity(scope, recurrence),
  category_tag_id: recurrence.categoryTagId,
  text: recurrence.text,
  bold: recurrence.bold,
  priority: recurrence.priority,
  children: recurrence.children,
  schedule: recurrence.schedule,
  content_history: recurrence.contentHistory,
});

const serializeRecurrenceResponse: RemoteSerializer<RecurrenceResponse> = (
  scope,
  response,
) => ({
  ...serializeBaseEntity(scope, response),
  recurrence_id: response.recurrenceId,
  date: response.date,
  item_id: response.itemId,
  status: response.status,
});

const remoteSerializers: Record<SyncEntityType, RemoteSerializer<never>> = {
  categoryTag: serializeCategoryTag,
  dailyEntry: serializeDailyEntry,
  checklistItem: serializeChecklistItem,
  goalGroup: serializeGoalGroup,
  goal: serializeGoal,
  goalStep: serializeGoalStep,
  recurrence: serializeRecurrence,
  recurrenceResponse: serializeRecurrenceResponse,
};

export function toRemotePayload(
  scope: AppScope,
  entityType: SyncEntityType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return remoteSerializers[entityType](scope, payload as never);
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
    useOwnName: row.use_own_name,
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
    scheduledTime: row.scheduled_time ?? null,
    checked: row.checked,
    ignored: row.ignored ?? false,
    markLevel: normalizeTaskCompletionValues({
      completed: row.checked,
      ignored: row.ignored,
      markLevel: row.mark_level,
    }).markLevel,
    bold: row.bold ?? false,
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
    dueDate: (row.due_date as Goal['dueDate']) ?? null,
    categoryTagId: row.category_tag_id,
    sortRank: row.sort_rank,
    archivedAt: row.completed_at,
  };
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function recurrenceFromRemote(
  scope: AppScope,
  row: RemoteRecurrence,
): Recurrence {
  return {
    ...baseFromRemote(scope, row),
    categoryTagId: row.category_tag_id,
    text: row.text,
    bold: row.bold,
    priority: row.priority,
    children: toArray(row.children),
    schedule: toArray(row.schedule),
    contentHistory: toArray(row.content_history),
  };
}

export function recurrenceResponseFromRemote(
  scope: AppScope,
  row: RemoteRecurrenceResponse,
): RecurrenceResponse {
  return {
    ...baseFromRemote(scope, row),
    recurrenceId: row.recurrence_id,
    date: row.date as RecurrenceResponse['date'],
    itemId: row.item_id,
    status: row.status as RecurrenceResponse['status'],
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
    ignored: row.ignored ?? false,
    markLevel: normalizeTaskCompletionValues({
      completed: row.completed,
      ignored: row.ignored,
      markLevel: row.mark_level,
    }).markLevel,
    bold: row.bold ?? false,
    priority: row.priority ?? false,
    collapsed: row.collapsed,
    categoryTagId: row.category_tag_id,
    scheduledDate: (row.scheduled_date as GoalStep['scheduledDate']) ?? null,
    sortRank: row.sort_rank,
  };
}
