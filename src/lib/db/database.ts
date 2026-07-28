import Dexie, { type Table, type Transaction } from 'dexie';
import type {
  CategoryTag,
  ChecklistItem,
  DailyEntry,
  Goal,
  GoalGroup,
  GoalStep,
  LocalPreference,
  SyncCursor,
  SyncOutboxItem,
} from '@/lib/domain';
import { createDeterministicDailyEntryId } from './daily-entry-id';

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

type LegacyChecklistItem = Omit<
  ChecklistItem,
  | 'categoryTagId'
  | 'parentId'
  | 'collapsed'
  | 'priority'
  | 'scheduledTime'
  | 'ignored'
  | 'bold'
> & {
  categoryTagId?: string | null;
  colorTagId?: string | null;
  parentId?: string | null;
  collapsed?: boolean;
  priority?: boolean;
  scheduledTime?: string | null;
  ignored?: boolean;
  bold?: boolean;
};

type LegacyGoal = Omit<Goal, 'categoryTagId'> & {
  categoryTagId?: string | null;
  colorTagId?: string | null;
};

type LegacyGoalStep = Omit<
  GoalStep,
  'parentId' | 'collapsed' | 'categoryTagId' | 'priority' | 'ignored' | 'bold'
> & {
  parentId?: string | null;
  collapsed?: boolean;
  priority?: boolean;
  categoryTagId?: string | null;
  colorTagId?: string | null;
  ignored?: boolean;
  bold?: boolean;
};

type LegacyCategoryTag = Omit<CategoryTag, 'colorHex'> & {
  colorHex?: string;
  hex?: string;
  surface?: CategoryTag['surface'];
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
  const {
    categoryTagId,
    colorTagId,
    parentId,
    collapsed,
    priority,
    scheduledTime,
    ignored,
    bold,
    ...rest
  } = item;

  return {
    ...rest,
    categoryTagId: categoryTagId ?? colorTagId ?? null,
    parentId: parentId ?? null,
    collapsed: collapsed ?? false,
    priority: priority ?? false,
    scheduledTime: scheduledTime ?? null,
    ignored: ignored ?? false,
    bold: bold ?? false,
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
  const { colorHex, hex, surface, ...rest } = categoryTag;

  return {
    ...rest,
    colorHex: colorHex ?? hex ?? '#71717a',
    surface: surface ?? 'calendar',
  };
}

function migrateGoalStep(goalStep: LegacyGoalStep): GoalStep {
  const {
    categoryTagId,
    collapsed,
    colorTagId,
    parentId,
    priority,
    ignored,
    bold,
    ...rest
  } = goalStep;

  return {
    ...rest,
    parentId: parentId ?? null,
    collapsed: collapsed ?? false,
    priority: priority ?? false,
    ignored: ignored ?? false,
    bold: bold ?? false,
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

function isAuthenticatedScopeId(scopeId: string): scopeId is `user:${string}` {
  return scopeId.startsWith('user:');
}

function compareByClientUpdatedAt(
  firstEntry: DailyEntry,
  secondEntry: DailyEntry,
): number {
  return secondEntry.clientUpdatedAt.localeCompare(firstEntry.clientUpdatedAt);
}

function chooseCanonicalDailyEntry(entries: DailyEntry[]): DailyEntry {
  const syncedEntries = entries
    .filter((entry) => entry.remoteRevision !== null)
    .sort(compareByClientUpdatedAt);

  if (syncedEntries[0]) {
    return syncedEntries[0];
  }

  const deterministicId = createDeterministicDailyEntryId(
    entries[0].scopeId,
    entries[0].date,
  );
  const deterministicEntry = entries.find(
    (entry) => entry.id === deterministicId,
  );

  return deterministicEntry ?? [...entries].sort(compareByClientUpdatedAt)[0];
}

function mergeDailyEntries({
  canonicalEntry,
  canonicalId,
  entries,
}: {
  canonicalEntry: DailyEntry;
  canonicalId: string;
  entries: DailyEntry[];
}): DailyEntry {
  const createdAt = entries
    .map((entry) => entry.createdAt)
    .sort((first, second) => first.localeCompare(second))[0];
  const latestEntry = [...entries].sort(compareByClientUpdatedAt)[0];
  const hasActiveEntry = entries.some((entry) => entry.deletedAt === null);
  const hasPendingEntry = entries.some(
    (entry) => entry.syncStatus !== 'synced',
  );

  return {
    ...latestEntry,
    id: canonicalId,
    scopeId: canonicalEntry.scopeId,
    date: canonicalEntry.date,
    createdAt: createdAt ?? canonicalEntry.createdAt,
    deletedAt: hasActiveEntry ? null : latestEntry.deletedAt,
    remoteRevision: canonicalEntry.remoteRevision,
    syncStatus: hasPendingEntry ? 'pending' : canonicalEntry.syncStatus,
  };
}

function remapOutboxPayload(
  item: SyncOutboxItem,
  oldDailyEntryIds: Set<string>,
  canonicalDailyEntry: DailyEntry,
): SyncOutboxItem {
  if (item.entityType === 'dailyEntry' && oldDailyEntryIds.has(item.entityId)) {
    return {
      ...item,
      entityId: canonicalDailyEntry.id,
      payload: {
        ...item.payload,
        ...canonicalDailyEntry,
      } as unknown as Record<string, unknown>,
    };
  }

  if (item.entityType === 'checklistItem') {
    const dailyEntryId = item.payload.dailyEntryId;

    if (
      typeof dailyEntryId === 'string' &&
      oldDailyEntryIds.has(dailyEntryId)
    ) {
      return {
        ...item,
        payload: {
          ...item.payload,
          dailyEntryId: canonicalDailyEntry.id,
        },
      };
    }
  }

  return item;
}

async function recalculateMigratedDailyEntrySummary({
  checklistItemsTable,
  dailyEntry,
}: {
  checklistItemsTable: Table<ChecklistItem, string>;
  dailyEntry: DailyEntry;
}): Promise<DailyEntry> {
  const checklistItems = await checklistItemsTable
    .where('[scopeId+dailyEntryId]')
    .equals([dailyEntry.scopeId, dailyEntry.id])
    .filter((item) => item.deletedAt === null)
    .toArray();
  const categorySummaryMap = new Map<
    string,
    { categoryTagId: string; itemCount: number; completedCount: number }
  >();

  for (const item of checklistItems) {
    if (!item.categoryTagId || item.ignored) {
      continue;
    }

    const summary = categorySummaryMap.get(item.categoryTagId) ?? {
      categoryTagId: item.categoryTagId,
      itemCount: 0,
      completedCount: 0,
    };

    summary.itemCount += 1;

    if (item.checked) {
      summary.completedCount += 1;
    }

    categorySummaryMap.set(item.categoryTagId, summary);
  }

  const sortedItems = [...checklistItems].sort((firstItem, secondItem) =>
    firstItem.sortRank.localeCompare(secondItem.sortRank),
  );
  const categorySummaries = Array.from(categorySummaryMap.values());
  const countedItems = checklistItems.filter((item) => !item.ignored);

  return {
    ...dailyEntry,
    previewText:
      sortedItems.find((item) => item.text.trim().length > 0)?.text.trim() ??
      '',
    itemCount: countedItems.length,
    completedCount: countedItems.filter((item) => item.checked).length,
    categoryTagIds: categorySummaries.map((summary) => summary.categoryTagId),
    categorySummaries,
  };
}

async function reconcileAuthenticatedDailyEntries(transaction: Transaction) {
  const dailyEntriesTable = transaction.table('dailyEntries') as Table<
    DailyEntry,
    string
  >;
  const checklistItemsTable = transaction.table('checklistItems') as Table<
    ChecklistItem,
    string
  >;
  const syncOutboxTable = transaction.table('syncOutbox') as Table<
    SyncOutboxItem,
    string
  >;
  const entriesByScopeAndDate = new Map<string, DailyEntry[]>();

  for (const entry of await dailyEntriesTable.toArray()) {
    if (!isAuthenticatedScopeId(entry.scopeId)) {
      continue;
    }

    const key = `${entry.scopeId}\n${entry.date}`;
    const entries = entriesByScopeAndDate.get(key) ?? [];
    entries.push(entry);
    entriesByScopeAndDate.set(key, entries);
  }

  for (const entries of entriesByScopeAndDate.values()) {
    const canonicalEntry = chooseCanonicalDailyEntry(entries);
    const canonicalId =
      canonicalEntry.remoteRevision === null
        ? createDeterministicDailyEntryId(
            canonicalEntry.scopeId,
            canonicalEntry.date,
          )
        : canonicalEntry.id;
    const oldDailyEntryIds = new Set(entries.map((entry) => entry.id));

    if (entries.length === 1 && canonicalEntry.id === canonicalId) {
      continue;
    }

    for (const checklistItem of await checklistItemsTable
      .where('scopeId')
      .equals(canonicalEntry.scopeId)
      .filter((item) => oldDailyEntryIds.has(item.dailyEntryId))
      .toArray()) {
      if (checklistItem.dailyEntryId === canonicalId) {
        continue;
      }

      await checklistItemsTable.put({
        ...checklistItem,
        dailyEntryId: canonicalId,
      });
    }

    let mergedEntry = mergeDailyEntries({
      canonicalEntry,
      canonicalId,
      entries,
    });
    mergedEntry = await recalculateMigratedDailyEntrySummary({
      checklistItemsTable,
      dailyEntry: mergedEntry,
    });

    await dailyEntriesTable.put(mergedEntry);

    for (const entry of entries) {
      if (entry.id !== canonicalId) {
        await dailyEntriesTable.delete(entry.id);
      }
    }

    for (const outboxItem of await syncOutboxTable
      .where('scopeId')
      .equals(canonicalEntry.scopeId)
      .filter(
        (item) =>
          oldDailyEntryIds.has(item.entityId) ||
          item.entityType === 'checklistItem',
      )
      .toArray()) {
      const remappedItem = remapOutboxPayload(
        outboxItem,
        oldDailyEntryIds,
        mergedEntry,
      );

      if (remappedItem !== outboxItem) {
        await syncOutboxTable.put(remappedItem);
      }
    }
  }
}

export class TickDatabase extends Dexie {
  dailyEntries!: Table<DailyEntry, string>;
  checklistItems!: Table<ChecklistItem, string>;
  categoryTags!: Table<CategoryTag, string>;
  goals!: Table<Goal, string>;
  goalSteps!: Table<GoalStep, string>;
  goalGroups!: Table<GoalGroup, string>;
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

    this.version(5)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
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
        const categoryTagsTable = transaction.table('colorTags') as Table<
          LegacyCategoryTag,
          string
        >;
        const syncOutboxTable = transaction.table('syncOutbox') as Table<
          LegacySyncOutboxItem,
          string
        >;

        for (const categoryTag of await categoryTagsTable.toArray()) {
          await categoryTagsTable.put(
            migrateCategoryTag(categoryTag) as LegacyCategoryTag,
          );
        }

        for (const outboxItem of await syncOutboxTable.toArray()) {
          await syncOutboxTable.put(
            migrateSyncOutboxItem(outboxItem) as LegacySyncOutboxItem,
          );
        }
      });

    this.version(6)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
        goals:
          'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
        goalSteps:
          'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
        syncOutbox:
          'id, scopeId, entityType, status, createdAt, [scopeId+status], [scopeId+createdAt]',
        syncCursors: 'id, scopeId, entityType, [scopeId+entityType]',
        localPreferences: 'key, scopeId, updatedAt',
      })
      .upgrade(reconcileAuthenticatedDailyEntries);

    this.version(7).stores({
      dailyEntries:
        'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
      checklistItems:
        'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
      colorTags:
        'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
      goals:
        'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
      goalSteps:
        'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
      syncOutbox: null,
      syncCursors: null,
      localPreferences: 'key, scopeId, updatedAt',
    });

    this.version(8)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
        goals:
          'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
        goalSteps:
          'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
        localPreferences: 'key, scopeId, updatedAt',
      })
      .upgrade(async (transaction) => {
        const goalStepsTable = transaction.table('goalSteps') as Table<
          LegacyGoalStep,
          string
        >;

        for (const goalStep of await goalStepsTable.toArray()) {
          await goalStepsTable.put(migrateGoalStep(goalStep) as LegacyGoalStep);
        }
      });

    this.version(9)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
        goalGroups: 'id, scopeId, updatedAt, deletedAt, [scopeId+updatedAt]',
        goals:
          'id, scopeId, groupId, category, completedAt, updatedAt, deletedAt, [scopeId+groupId], [scopeId+category], [scopeId+completedAt], [scopeId+updatedAt]',
        goalSteps:
          'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
        localPreferences: 'key, scopeId, updatedAt',
      })
      .upgrade(async (transaction) => {
        const dailyEntries = transaction.table('dailyEntries') as Table<
          DailyEntry,
          string
        >;
        const checklistItems = transaction.table('checklistItems') as Table<
          ChecklistItem,
          string
        >;
        const categoryTags = transaction.table('colorTags') as Table<
          CategoryTag,
          string
        >;
        const goalGroups = transaction.table('goalGroups') as Table<
          GoalGroup,
          string
        >;
        const goals = transaction.table('goals') as Table<Goal, string>;
        const goalSteps = transaction.table('goalSteps') as Table<
          GoalStep,
          string
        >;

        const userScopeIds = new Set(
          [
            ...(await dailyEntries.toArray()),
            ...(await checklistItems.toArray()),
            ...(await categoryTags.toArray()),
            ...(await goals.toArray()),
            ...(await goalSteps.toArray()),
          ]
            .map((entity) => entity.scopeId)
            .filter((scopeId) => scopeId.startsWith('user:')),
        );

        for (const scopeId of userScopeIds) {
          await dailyEntries.where('scopeId').equals(scopeId).delete();
          await checklistItems.where('scopeId').equals(scopeId).delete();
          await categoryTags.where('scopeId').equals(scopeId).delete();
          await goals.where('scopeId').equals(scopeId).delete();
          await goalSteps.where('scopeId').equals(scopeId).delete();
        }

        for (const categoryTag of await categoryTags.toArray()) {
          await categoryTags.put({
            ...categoryTag,
            surface:
              categoryTag.surface === 'calendar'
                ? 'checklist_item'
                : categoryTag.surface === 'goals'
                  ? 'goal'
                  : categoryTag.surface,
          });
        }

        const guestGoals = (await goals.toArray()).filter((goal) =>
          goal.scopeId.startsWith('guest:'),
        );
        const guestGoalSteps = (await goalSteps.toArray()).filter((step) =>
          step.scopeId.startsWith('guest:'),
        );

        for (const legacyGoal of guestGoals) {
          const groupId = `group:${legacyGoal.id}`;
          await goalGroups.put({
            id: groupId,
            scopeId: legacyGoal.scopeId,
            title: legacyGoal.title,
            categoryTagId: null,
            sortRank: legacyGoal.sortRank,
            createdAt: legacyGoal.createdAt,
            updatedAt: legacyGoal.updatedAt,
            deletedAt: legacyGoal.deletedAt,
            syncStatus: legacyGoal.syncStatus,
            remoteRevision: null,
            clientUpdatedAt: legacyGoal.clientUpdatedAt,
          });

          const rootSteps = guestGoalSteps.filter(
            (step) => step.goalId === legacyGoal.id && step.parentId === null,
          );

          for (const rootStep of rootSteps) {
            await goals.put({
              ...legacyGoal,
              id: rootStep.id,
              groupId,
              title: rootStep.text,
              categoryTagId: rootStep.categoryTagId,
              sortRank: rootStep.sortRank,
              completedAt: rootStep.completed ? rootStep.updatedAt : null,
              archivedAt: rootStep.completed ? rootStep.updatedAt : null,
              status: rootStep.completed ? 'completed' : 'active',
              createdAt: rootStep.createdAt,
              updatedAt: rootStep.updatedAt,
              clientUpdatedAt: rootStep.clientUpdatedAt,
            });

            for (const descendant of guestGoalSteps.filter(
              (step) =>
                step.goalId === legacyGoal.id && step.id !== rootStep.id,
            )) {
              let ancestorId = descendant.parentId;
              let belongsToRoot = false;

              while (ancestorId) {
                if (ancestorId === rootStep.id) {
                  belongsToRoot = true;
                  break;
                }
                ancestorId =
                  guestGoalSteps.find((step) => step.id === ancestorId)
                    ?.parentId ?? null;
              }

              if (belongsToRoot) {
                await goalSteps.put({
                  ...descendant,
                  goalId: rootStep.id,
                  parentId:
                    descendant.parentId === rootStep.id
                      ? null
                      : descendant.parentId,
                });
              }
            }

            await goalSteps.delete(rootStep.id);
          }

          await goals.delete(legacyGoal.id);
        }
      });

    this.version(10)
      .stores({
        dailyEntries:
          'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
        checklistItems:
          'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
        colorTags:
          'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
        goalGroups: 'id, scopeId, updatedAt, deletedAt, [scopeId+updatedAt]',
        goals:
          'id, scopeId, groupId, category, completedAt, updatedAt, deletedAt, [scopeId+groupId], [scopeId+category], [scopeId+completedAt], [scopeId+updatedAt]',
        goalSteps:
          'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
        localPreferences: 'key, scopeId, updatedAt',
      })
      .upgrade(async (transaction) => {
        const checklistItemsTable = transaction.table(
          'checklistItems',
        ) as Table<LegacyChecklistItem, string>;

        for (const item of await checklistItemsTable.toArray()) {
          await checklistItemsTable.put(
            migrateChecklistItem(item) as LegacyChecklistItem,
          );
        }
      });

    this.version(11).upgrade(async (transaction) => {
      const checklistItemsTable = transaction.table('checklistItems') as Table<
        LegacyChecklistItem,
        string
      >;

      for (const item of await checklistItemsTable.toArray()) {
        await checklistItemsTable.put(
          migrateChecklistItem(item) as LegacyChecklistItem,
        );
      }
    });

    this.version(12).upgrade(async (transaction) => {
      const categoryTagsTable = transaction.table('colorTags') as Table<
        CategoryTag,
        string
      >;

      for (const categoryTag of await categoryTagsTable.toArray()) {
        await categoryTagsTable.put({
          ...categoryTag,
          useOwnName: categoryTag.useOwnName ?? false,
        });
      }
    });

    this.version(13).upgrade(async (transaction) => {
      const checklistItemsTable = transaction.table('checklistItems') as Table<
        LegacyChecklistItem,
        string
      >;
      const goalStepsTable = transaction.table('goalSteps') as Table<
        LegacyGoalStep,
        string
      >;

      for (const item of await checklistItemsTable.toArray()) {
        await checklistItemsTable.put(
          migrateChecklistItem(item) as LegacyChecklistItem,
        );
      }

      for (const goalStep of await goalStepsTable.toArray()) {
        await goalStepsTable.put(migrateGoalStep(goalStep) as LegacyGoalStep);
      }
    });

    this.version(14).upgrade(async (transaction) => {
      const checklistItemsTable = transaction.table('checklistItems') as Table<
        LegacyChecklistItem,
        string
      >;
      const goalStepsTable = transaction.table('goalSteps') as Table<
        LegacyGoalStep,
        string
      >;

      for (const item of await checklistItemsTable.toArray()) {
        await checklistItemsTable.put(
          migrateChecklistItem(item) as LegacyChecklistItem,
        );
      }

      for (const goalStep of await goalStepsTable.toArray()) {
        await goalStepsTable.put(migrateGoalStep(goalStep) as LegacyGoalStep);
      }
    });

    this.categoryTags = this.table('colorTags');
  }
}

export const db = new TickDatabase();
