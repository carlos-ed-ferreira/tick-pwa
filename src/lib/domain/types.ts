export type AppScopeKind = 'guest' | 'user';

export type AppScopeId = `guest:${string}` | `user:${string}`;

export type EntitySyncStatus =
  | 'local'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed';

export type LocalDateString = `${number}-${number}-${number}`;

export type SupportedLocale = 'pt-BR' | 'en';

export type TimezoneDetectionSource =
  | 'browser'
  | 'region'
  | 'manual'
  | 'fallback';

export type GoalCategory = 'short' | 'medium' | 'long' | 'now';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type GoalProgressMode = 'manual' | 'steps';

export type PersistedCategoryTagSurface =
  | 'checklist_item'
  | 'goal_group'
  | 'goal'
  | 'goal_step'
  | 'recurrence';
export type CategoryTagSurface =
  | PersistedCategoryTagSurface
  | 'calendar'
  | 'goals';

export type SyncEntityType =
  | 'dailyEntry'
  | 'checklistItem'
  | 'categoryTag'
  | 'goalGroup'
  | 'goal'
  | 'goalStep'
  | 'recurrence'
  | 'recurrenceResponse';

export type SyncOperation = 'upsert' | 'delete';

export type SyncOutboxStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface AppScope {
  id: AppScopeId;
  kind: AppScopeKind;
  ownerId: string;
}

export interface LocalePreference {
  locale: SupportedLocale;
  timezone: string;
  timezoneOffset: string;
  detectedFrom: TimezoneDetectionSource;
  updatedAt: string;
}

export interface SyncMetadata {
  syncStatus: EntitySyncStatus;
  remoteRevision: number | null;
  clientUpdatedAt: string;
}

export interface BaseEntity extends SyncMetadata {
  id: string;
  scopeId: AppScopeId;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DailyEntry extends BaseEntity {
  date: LocalDateString;
  timezone: string;
  title: string;
  note: string;
  previewText: string;
  itemCount: number;
  completedCount: number;
  categoryTagIds: string[];
  categorySummaries?: DailyEntryCategorySummary[];
}

export interface DailyEntryCategorySummary {
  categoryTagId: string;
  itemCount: number;
  completedCount: number;
}

export interface ChecklistItem extends BaseEntity {
  dailyEntryId: string;
  parentId: string | null;
  text: string;
  scheduledTime: string | null;
  checked: boolean;
  ignored: boolean;
  markLevel: number;
  bold: boolean;
  priority: boolean;
  collapsed: boolean;
  categoryTagId: string | null;
  sortRank: string;
}

export interface CategoryTag extends BaseEntity {
  name: string;
  colorHex: string;
  position: string;
  surface: CategoryTagSurface;
  useOwnName: boolean;
}

export type RecurrenceWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurrenceWeekOrdinal = 1 | 2 | 3 | 4 | 'last';

export type RecurrenceRule =
  | { kind: 'interval'; everyDays: number; anchorDate: LocalDateString }
  | {
      kind: 'weekly';
      everyWeeks: number;
      weekdays: RecurrenceWeekday[];
      anchorDate: LocalDateString | null;
    }
  | { kind: 'monthly_day'; day: number }
  | { kind: 'monthly_last_day' }
  | {
      kind: 'monthly_weekday';
      ordinal: RecurrenceWeekOrdinal;
      weekday: RecurrenceWeekday;
    };

export interface RecurrenceScheduleSegment {
  from: LocalDateString | null;
  rule: RecurrenceRule | null;
}

export interface RecurrenceMeasure {
  target: number;
  unit: string;
}

export interface RecurrenceQuantity extends RecurrenceMeasure {
  value: number;
}

export interface RecurrenceChild {
  id: string;
  parentId: string | null;
  text: string;
  bold: boolean;
  priority: boolean;
  sortRank: string;
  measure?: RecurrenceMeasure | null;
}

export interface RecurrenceContent {
  text: string;
  bold: boolean;
  priority: boolean;
  categoryTagId: string | null;
  children: RecurrenceChild[];
  measure?: RecurrenceMeasure | null;
}

export interface RecurrenceContentSnapshot extends RecurrenceContent {
  until: LocalDateString;
}

export interface Recurrence extends BaseEntity, RecurrenceContent {
  schedule: RecurrenceScheduleSegment[];
  contentHistory: RecurrenceContentSnapshot[];
}

export type RecurrenceResponseStatus = 'done' | 'not_done';

export interface RecurrenceResponse extends BaseEntity {
  recurrenceId: string;
  date: LocalDateString;
  itemId: string | null;
  status: RecurrenceResponseStatus;
  quantity?: RecurrenceQuantity | null;
}

export interface RecurrenceOccurrence {
  recurrence: Recurrence;
  content: RecurrenceContent;
  date: LocalDateString;
  status: RecurrenceResponseStatus | null;
  childStatuses: Record<string, RecurrenceResponseStatus>;
  quantity: RecurrenceQuantity | null;
  childQuantities: Record<string, RecurrenceQuantity>;
}

export interface Goal extends BaseEntity {
  groupId: string | null;
  completedAt: string | null;
  category: GoalCategory;
  title: string;
  description: string;
  status: GoalStatus;
  progressMode: GoalProgressMode;
  progressValue: number;
  dueDate: LocalDateString | null;
  categoryTagId: string | null;
  sortRank: string;
  archivedAt: string | null;
}

export interface GoalGroup extends BaseEntity {
  title: string;
  categoryTagId: string | null;
  sortRank: string;
}

export interface GoalStep extends BaseEntity {
  goalId: string;
  parentId: string | null;
  text: string;
  completed: boolean;
  ignored: boolean;
  markLevel: number;
  bold: boolean;
  priority: boolean;
  collapsed: boolean;
  categoryTagId: string | null;
  scheduledDate: LocalDateString | null;
  sortRank: string;
}

export interface SyncOutboxItem {
  id: string;
  scopeId: AppScopeId;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  changedFields: string[];
  baseRevision: number | null;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: SyncOutboxStatus;
}

export interface AccountOperationOutboxMutation {
  baseRevision: number | null;
  clientUpdatedAt: string;
  entityId: string;
  entityType: SyncEntityType;
  operation: SyncOperation;
  payload: Record<string, unknown>;
}

export interface AccountOperationOutboxItem {
  id: string;
  scopeId: AppScopeId;
  mutations: AccountOperationOutboxMutation[];
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  rebasedAt: string | null;
  status: SyncOutboxStatus;
}

export interface SyncCursor {
  id: string;
  scopeId: AppScopeId;
  entityType: SyncEntityType;
  lastPulledAt: string | null;
  lastRemoteRevision: number | null;
  updatedAt: string;
}

export interface LocalPreference<TValue = unknown> {
  key: string;
  scopeId: AppScopeId | null;
  value: TValue;
  updatedAt: string;
  syncStatus?: SyncOutboxStatus;
  attempts?: number;
  nextAttemptAt?: string | null;
  writeId?: string;
}
