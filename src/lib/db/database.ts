import Dexie, { type Table } from 'dexie';
import type {
  CategoryTag,
  ChecklistItem,
  DailyEntry,
  Goal,
  GoalStep,
  LocalPreference,
  SyncCursor,
  SyncOutboxItem,
} from '@/lib/domain';

type LegacyDailyEntry = Omit<
  DailyEntry,
  'categoryTagIds' | 'categorySummaries'
> & {
  categoryTagIds?: string[];
  categorySummaries?: DailyEntry['categorySummaries'];
  colorTagIds?: string[];
  colorSummaries?: Array<{
    colorTagId: string;
    itemCount: number;
    completedCount: number;
  }>;
};

type LegacyChecklistItem = Omit<ChecklistItem, 'categoryTagId' | 'priority'> & {
  categoryTagId?: string | null;
  colorTagId?: string | null;
  priority?: boolean;
};

type LegacyGoal = Omit<Goal, 'categoryTagId'> & {
  categoryTagId?: string | null;
  colorTagId?: string | null;
};

type LegacyGoalStep = Omit<
  GoalStep,
  'parentId' | 'collapsed' | 'categoryTagId'
> & {
  parentId?: string | null;
  collapsed?: boolean;
  categoryTagId?: string | null;
  colorTagId?: string | null;
};

type LegacyCategoryTag = Omit<CategoryTag, 'colorHex'> & {
  colorHex?: string;
  hex?: string;
};

type LegacySyncOutboxItem = Omit<SyncOutboxItem, 'entityType' | 'payload'> & {
  entityType: string;
  payload: Record<string, unknown>;
};

type LegacySyncCursor = Omit<SyncCursor, 'entityType'> & {
  entityType: string;
};

function migrateDailyEntry(entry: LegacyDailyEntry): DailyEntry {
  const {
    categoryTagIds,
    categorySummaries,
    colorTagIds,
    colorSummaries,
    ...rest
  } = entry;

  return {
    ...rest,
    categoryTagIds: categoryTagIds ?? colorTagIds ?? [],
    categorySummaries:
      categorySummaries ??
      (colorSummaries ?? []).map((summary) => ({
        categoryTagId: summary.colorTagId,
        itemCount: summary.itemCount,
        completedCount: summary.completedCount,
      })),
  };
}

function migrateChecklistItem(item: LegacyChecklistItem): ChecklistItem {
  const { categoryTagId, colorTagId, priority, ...rest } = item;

  return {
    ...rest,
    categoryTagId: categoryTagId ?? colorTagId ?? null,
    priority: priority ?? false,
  };
}

function migrateGoal(goal: LegacyGoal): Goal {
  const { categoryTagId, colorTagId, ...rest } = goal;

  return {
    ...rest,
    categoryTagId: categoryTagId ?? colorTagId ?? null,
  };
}

function migrateCategoryTag(categoryTag: LegacyCategoryTag): CategoryTag {
  const { colorHex, hex, ...rest } = categoryTag;

  return {
    ...rest,
    colorHex: colorHex ?? hex ?? '#71717a',
  };
}

function migrateGoalStep(goalStep: LegacyGoalStep): GoalStep {
  const { categoryTagId, collapsed, colorTagId, parentId, ...rest } = goalStep;

  return {
    ...rest,
    parentId: parentId ?? null,
    collapsed: collapsed ?? false,
    categoryTagId: categoryTagId ?? colorTagId ?? null,
  };
}

function renameChangedField(field: string): string {
  if (field === 'colorTagId') {
    return 'categoryTagId';
  }

  if (field === 'colorTagIds') {
    return 'categoryTagIds';
  }

  if (field === 'colorSummaries') {
    return 'categorySummaries';
  }

  if (field === 'hex') {
    return 'colorHex';
  }

  return field;
}

function migrateOutboxPayload(
  entityType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (entityType === 'dailyEntry') {
    return migrateDailyEntry(payload as LegacyDailyEntry) as unknown as Record<
      string,
      unknown
    >;
  }

  if (entityType === 'checklistItem') {
    return migrateChecklistItem(
      payload as LegacyChecklistItem,
    ) as unknown as Record<string, unknown>;
  }

  if (entityType === 'goal') {
    return migrateGoal(payload as LegacyGoal) as unknown as Record<
      string,
      unknown
    >;
  }

  if (entityType === 'goalStep') {
    return migrateGoalStep(payload as LegacyGoalStep) as unknown as Record<
      string,
      unknown
    >;
  }

  if (entityType === 'colorTag' || entityType === 'categoryTag') {
    return migrateCategoryTag(
      payload as LegacyCategoryTag,
    ) as unknown as Record<string, unknown>;
  }

  return payload;
}

function migrateSyncOutboxItem(item: LegacySyncOutboxItem): SyncOutboxItem {
  const nextEntityType =
    item.entityType === 'colorTag' ? 'categoryTag' : item.entityType;

  return {
    ...item,
    entityType: nextEntityType as SyncOutboxItem['entityType'],
    payload: migrateOutboxPayload(item.entityType, item.payload),
    changedFields: item.changedFields.map(renameChangedField),
  };
}

function migrateSyncCursor(cursor: LegacySyncCursor): SyncCursor {
  return {
    ...cursor,
    entityType: (cursor.entityType === 'colorTag'
      ? 'categoryTag'
      : cursor.entityType) as SyncCursor['entityType'],
  };
}

export class TickDatabase extends Dexie {
  dailyEntries!: Table<DailyEntry, string>;
  checklistItems!: Table<ChecklistItem, string>;
  categoryTags!: Table<CategoryTag, string>;
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

    this.version(2)
      .stores({
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
      })
      .upgrade(async (transaction) => {
        const dailyEntriesTable = transaction.table('dailyEntries') as Table<
          LegacyDailyEntry,
          string
        >;
        const checklistItemsTable = transaction.table(
          'checklistItems',
        ) as Table<LegacyChecklistItem, string>;
        const categoryTagsTable = transaction.table('colorTags') as Table<
          LegacyCategoryTag,
          string
        >;
        const goalsTable = transaction.table('goals') as Table<
          LegacyGoal,
          string
        >;
        const syncOutboxTable = transaction.table('syncOutbox') as Table<
          LegacySyncOutboxItem,
          string
        >;
        const syncCursorsTable = transaction.table('syncCursors') as Table<
          LegacySyncCursor,
          string
        >;

        for (const entry of await dailyEntriesTable.toArray()) {
          await dailyEntriesTable.put(
            migrateDailyEntry(entry) as LegacyDailyEntry,
          );
        }

        for (const item of await checklistItemsTable.toArray()) {
          await checklistItemsTable.put(
            migrateChecklistItem(item) as LegacyChecklistItem,
          );
        }

        for (const categoryTag of await categoryTagsTable.toArray()) {
          await categoryTagsTable.put(
            migrateCategoryTag(categoryTag) as LegacyCategoryTag,
          );
        }

        for (const goal of await goalsTable.toArray()) {
          await goalsTable.put(migrateGoal(goal) as LegacyGoal);
        }

        for (const outboxItem of await syncOutboxTable.toArray()) {
          await syncOutboxTable.put(
            migrateSyncOutboxItem(outboxItem) as LegacySyncOutboxItem,
          );
        }

        for (const cursor of await syncCursorsTable.toArray()) {
          await syncCursorsTable.put(
            migrateSyncCursor(cursor) as LegacySyncCursor,
          );
        }
      });

    this.version(3)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, position, updatedAt, deletedAt, [scopeId+position], [scopeId+updatedAt]',
        goals:
          'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
        goalSteps:
          'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
        syncOutbox:
          'id, scopeId, entityType, status, createdAt, [scopeId+status], [scopeId+createdAt]',
        syncCursors: 'id, scopeId, entityType, [scopeId+entityType]',
        localPreferences: 'key, scopeId, updatedAt',
      })
      .upgrade(async (transaction) => {
        const goalStepsTable = transaction.table('goalSteps') as Table<
          LegacyGoalStep,
          string
        >;
        const syncOutboxTable = transaction.table('syncOutbox') as Table<
          LegacySyncOutboxItem,
          string
        >;

        for (const goalStep of await goalStepsTable.toArray()) {
          await goalStepsTable.put(migrateGoalStep(goalStep) as LegacyGoalStep);
        }

        for (const outboxItem of await syncOutboxTable.toArray()) {
          await syncOutboxTable.put(
            migrateSyncOutboxItem(outboxItem) as LegacySyncOutboxItem,
          );
        }
      });

    this.version(4)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, position, updatedAt, deletedAt, [scopeId+position], [scopeId+updatedAt]',
        goals:
          'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
        goalSteps:
          'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
        syncOutbox:
          'id, scopeId, entityType, status, createdAt, [scopeId+status], [scopeId+createdAt]',
        syncCursors: 'id, scopeId, entityType, [scopeId+entityType]',
        localPreferences: 'key, scopeId, updatedAt',
      })
      .upgrade(async (transaction) => {
        const checklistItemsTable = transaction.table(
          'checklistItems',
        ) as Table<LegacyChecklistItem, string>;
        const syncOutboxTable = transaction.table('syncOutbox') as Table<
          LegacySyncOutboxItem,
          string
        >;

        for (const item of await checklistItemsTable.toArray()) {
          await checklistItemsTable.put(
            migrateChecklistItem(item) as LegacyChecklistItem,
          );
        }

        for (const outboxItem of await syncOutboxTable.toArray()) {
          await syncOutboxTable.put(
            migrateSyncOutboxItem(outboxItem) as LegacySyncOutboxItem,
          );
        }
      });

    this.categoryTags = this.table('colorTags');
  }
}

export const db = new TickDatabase();
