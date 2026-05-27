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

export type GoalCategory = 'short' | 'medium' | 'long';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type GoalProgressMode = 'manual' | 'steps';

export type CategoryTagSurface = 'calendar' | 'goals';

export type SyncEntityType =
  | 'dailyEntry'
  | 'checklistItem'
  | 'categoryTag'
  | 'goal'
  | 'goalStep';

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
  checked: boolean;
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
}

export interface Goal extends BaseEntity {
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

export interface GoalStep extends BaseEntity {
  goalId: string;
  parentId: string | null;
  text: string;
  completed: boolean;
  collapsed: boolean;
  categoryTagId: string | null;
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
}
