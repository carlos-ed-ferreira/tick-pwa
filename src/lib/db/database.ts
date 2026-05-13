import Dexie, { type Table } from 'dexie';
import type {
  ChecklistItem,
  ColorTag,
  DailyEntry,
  Goal,
  GoalStep,
  LocalPreference,
  SyncCursor,
  SyncOutboxItem,
} from '@/lib/domain';

export class TickDatabase extends Dexie {
  dailyEntries!: Table<DailyEntry, string>;
  checklistItems!: Table<ChecklistItem, string>;
  colorTags!: Table<ColorTag, string>;
  goals!: Table<Goal, string>;
  goalSteps!: Table<GoalStep, string>;
  syncOutbox!: Table<SyncOutboxItem, string>;
  syncCursors!: Table<SyncCursor, string>;
  localPreferences!: Table<LocalPreference, string>;

  constructor() {
    super('tick');

    this.version(1).stores({
      dailyEntries:
        'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
      checklistItems:
        'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
      colorTags:
        'id, scopeId, position, updatedAt, deletedAt, [scopeId+position], [scopeId+updatedAt]',
      goals:
        'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
      goalSteps:
        'id, scopeId, goalId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+updatedAt]',
      syncOutbox:
        'id, scopeId, entityType, status, createdAt, [scopeId+status], [scopeId+createdAt]',
      syncCursors: 'id, scopeId, entityType, [scopeId+entityType]',
      localPreferences: 'key, scopeId, updatedAt',
    });
  }
}

export const db = new TickDatabase();
