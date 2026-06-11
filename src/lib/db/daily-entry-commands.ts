import type {
  AppScope,
  DailyEntry,
  DailyEntryCategorySummary,
  LocalDateString,
} from '@/lib/domain';
import { compareSortRanks, createId } from '@/lib/domain';
import { db } from './database';
import { createDailyEntryId } from './daily-entry-id';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { persistAccountEntityChange } from './account-persistence';

export async function openOrCreateDailyEntry({
  scope,
  date,
  timezone,
}: {
  scope: AppScope;
  date: LocalDateString;
  timezone: string;
}): Promise<DailyEntry> {
  return db.transaction('rw', db.dailyEntries, async () => {
    const existingEntry = await db.dailyEntries
      .where('[scopeId+date]')
      .equals([scope.id, date])
      .first();

    if (existingEntry && existingEntry.deletedAt === null) {
      return existingEntry;
    }

    const now = createTimestamp();

    if (existingEntry) {
      const restoredEntry: DailyEntry = {
        ...existingEntry,
        timezone,
        deletedAt: null,
        updatedAt: now,
        syncStatus: getEntitySyncStatus(scope),
        clientUpdatedAt: now,
      };

      await db.dailyEntries.put(restoredEntry);
      await persistAccountEntityChange({
        scope,
        entityType: 'dailyEntry',
        entityId: restoredEntry.id,
        operation: 'upsert',
        payload: restoredEntry as unknown as Record<string, unknown>,
        changedFields: ['timezone', 'deletedAt', 'updatedAt'],
        baseRevision: restoredEntry.remoteRevision,
      });

      return restoredEntry;
    }

    const entry: DailyEntry = {
      id: createDailyEntryId({ scope, date }) ?? createId(),
      scopeId: scope.id,
      date,
      timezone,
      title: '',
      note: '',
      previewText: '',
      itemCount: 0,
      completedCount: 0,
      categoryTagIds: [],
      categorySummaries: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.dailyEntries.add(entry);
    await persistAccountEntityChange({
      scope,
      entityType: 'dailyEntry',
      entityId: entry.id,
      operation: 'upsert',
      payload: entry as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    return entry;
  });
}

export async function recalculateDailyEntrySummary({
  scope,
  dailyEntryId,
}: {
  scope: AppScope;
  dailyEntryId: string;
}): Promise<void> {
  const [dailyEntry, checklistItems] = await Promise.all([
    db.dailyEntries.get(dailyEntryId),
    db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, dailyEntryId])
      .filter((item) => item.deletedAt === null)
      .toArray(),
  ]);

  if (!dailyEntry || dailyEntry.scopeId !== scope.id) {
    return;
  }

  const sortedItems = [...checklistItems].sort((firstItem, secondItem) =>
    compareSortRanks(firstItem.sortRank, secondItem.sortRank),
  );
  const previewText =
    sortedItems.find((item) => item.text.trim().length > 0)?.text.trim() ?? '';
  const categorySummaryMap = new Map<string, DailyEntryCategorySummary>();

  for (const item of sortedItems) {
    if (!item.categoryTagId) {
      continue;
    }

    const existingSummary = categorySummaryMap.get(item.categoryTagId) ?? {
      categoryTagId: item.categoryTagId,
      itemCount: 0,
      completedCount: 0,
    };

    existingSummary.itemCount += 1;

    if (item.checked) {
      existingSummary.completedCount += 1;
    }

    categorySummaryMap.set(item.categoryTagId, existingSummary);
  }

  const categorySummaries = Array.from(categorySummaryMap.values());
  const categoryTagIds = categorySummaries.map(
    (summary) => summary.categoryTagId,
  );
  const now = createTimestamp();
  const updatedEntry: DailyEntry = {
    ...dailyEntry,
    previewText,
    itemCount: checklistItems.length,
    completedCount: checklistItems.filter((item) => item.checked).length,
    categoryTagIds,
    categorySummaries,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };

  await db.dailyEntries.put(updatedEntry);
  await persistAccountEntityChange({
    scope,
    entityType: 'dailyEntry',
    entityId: updatedEntry.id,
    operation: 'upsert',
    payload: updatedEntry as unknown as Record<string, unknown>,
    changedFields: [
      'previewText',
      'itemCount',
      'completedCount',
      'categoryTagIds',
      'categorySummaries',
    ],
    baseRevision: updatedEntry.remoteRevision,
  });
}
