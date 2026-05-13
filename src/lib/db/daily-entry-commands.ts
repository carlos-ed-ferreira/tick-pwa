import type { AppScope, DailyEntry, LocalDateString } from '@/lib/domain';
import { compareSortRanks, createId } from '@/lib/domain';
import { db } from './database';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { queueSyncOutboxItem } from './sync-outbox';

export async function openOrCreateDailyEntry({
  scope,
  date,
  timezone,
}: {
  scope: AppScope;
  date: LocalDateString;
  timezone: string;
}): Promise<DailyEntry> {
  return db.transaction('rw', db.dailyEntries, db.syncOutbox, async () => {
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
      await queueSyncOutboxItem({
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
      id: createId(),
      scopeId: scope.id,
      date,
      timezone,
      title: '',
      note: '',
      previewText: '',
      itemCount: 0,
      completedCount: 0,
      colorTagIds: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.dailyEntries.add(entry);
    await queueSyncOutboxItem({
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
  const colorTagIds = Array.from(
    new Set(
      sortedItems
        .map((item) => item.colorTagId)
        .filter((colorTagId): colorTagId is string => Boolean(colorTagId)),
    ),
  );
  const now = createTimestamp();
  const updatedEntry: DailyEntry = {
    ...dailyEntry,
    previewText,
    itemCount: checklistItems.length,
    completedCount: checklistItems.filter((item) => item.checked).length,
    colorTagIds,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };

  await db.dailyEntries.put(updatedEntry);
  await queueSyncOutboxItem({
    scope,
    entityType: 'dailyEntry',
    entityId: updatedEntry.id,
    operation: 'upsert',
    payload: updatedEntry as unknown as Record<string, unknown>,
    changedFields: [
      'previewText',
      'itemCount',
      'completedCount',
      'colorTagIds',
    ],
    baseRevision: updatedEntry.remoteRevision,
  });
}
