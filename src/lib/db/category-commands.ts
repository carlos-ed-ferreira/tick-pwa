import type { AppScope, CategoryTag } from '@/lib/domain';
import {
  compareSortRanks,
  createId,
  createSortRankBetween,
} from '@/lib/domain';
import { db } from './database';
import { recalculateDailyEntrySummary } from './daily-entry-commands';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { clearGuestDefaultCategoryTagTracking } from './seed';
import { queueSyncOutboxItem } from './sync-outbox';

function normalizeColorHex(colorHex: string): string {
  const normalizedHex = colorHex.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return normalizedHex.toLowerCase();
  }

  return '#71717a';
}

function normalizeCategoryTagName(name: string): string {
  return name.normalize('NFC').trim().toLocaleUpperCase();
}

async function getActiveCategoryTags(scope: AppScope): Promise<CategoryTag[]> {
  const categoryTags = await db.categoryTags
    .where('scopeId')
    .equals(scope.id)
    .filter((tag) => tag.deletedAt === null)
    .toArray();

  return categoryTags.sort((firstTag, secondTag) =>
    compareSortRanks(firstTag.position, secondTag.position),
  );
}

async function persistCategoryTagUpdate(
  scope: AppScope,
  categoryTag: CategoryTag,
  changedFields: string[],
): Promise<void> {
  await db.categoryTags.put(categoryTag);
  await queueSyncOutboxItem({
    scope,
    entityType: 'categoryTag',
    entityId: categoryTag.id,
    operation: categoryTag.deletedAt ? 'delete' : 'upsert',
    payload: categoryTag as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: categoryTag.remoteRevision,
  });
}

function touchCategoryTag(
  scope: AppScope,
  categoryTag: CategoryTag,
): CategoryTag {
  const now = createTimestamp();

  return {
    ...categoryTag,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

export async function createCategoryTag({
  scope,
  name,
  colorHex,
}: {
  scope: AppScope;
  name: string;
  colorHex: string;
}): Promise<CategoryTag> {
  return db.transaction('rw', db.categoryTags, db.syncOutbox, async () => {
    const categoryTags = await getActiveCategoryTags(scope);
    const now = createTimestamp();
    const categoryTag: CategoryTag = {
      id: createId(),
      scopeId: scope.id,
      name: normalizeCategoryTagName(name) || 'CATEGORY',
      colorHex: normalizeColorHex(colorHex),
      position: createSortRankBetween(
        categoryTags.at(-1)?.position ?? null,
        null,
      ),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.categoryTags.add(categoryTag);
    await queueSyncOutboxItem({
      scope,
      entityType: 'categoryTag',
      entityId: categoryTag.id,
      operation: 'upsert',
      payload: categoryTag as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    return categoryTag;
  });
}

export async function updateCategoryTag({
  scope,
  categoryTagId,
  name,
  colorHex,
}: {
  scope: AppScope;
  categoryTagId: string;
  name?: string;
  colorHex?: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.categoryTags,
    db.localPreferences,
    db.syncOutbox,
    async () => {
      const categoryTag = await db.categoryTags.get(categoryTagId);

      if (
        !categoryTag ||
        categoryTag.scopeId !== scope.id ||
        categoryTag.deletedAt
      ) {
        return;
      }

      const nextName =
        name === undefined
          ? categoryTag.name
          : normalizeCategoryTagName(name) || categoryTag.name;
      const nextColorHex =
        colorHex === undefined
          ? categoryTag.colorHex
          : normalizeColorHex(colorHex);

      if (
        nextName === categoryTag.name &&
        nextColorHex === categoryTag.colorHex
      ) {
        return;
      }

      const updatedCategoryTag = touchCategoryTag(scope, {
        ...categoryTag,
        name: nextName,
        colorHex: nextColorHex,
      });
      const changedFields = [
        ...(name === undefined ? [] : ['name']),
        ...(colorHex === undefined ? [] : ['colorHex']),
      ];

      if (changedFields.length === 0) {
        return;
      }

      await persistCategoryTagUpdate(scope, updatedCategoryTag, changedFields);

      if (
        scope.kind === 'guest' &&
        name !== undefined &&
        nextName !== categoryTag.name
      ) {
        await clearGuestDefaultCategoryTagTracking(scope, categoryTag.id);
      }
    },
  );
}

export async function reorderCategoryTag({
  scope,
  categoryTagId,
  direction,
}: {
  scope: AppScope;
  categoryTagId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction('rw', db.categoryTags, db.syncOutbox, async () => {
    const categoryTags = await getActiveCategoryTags(scope);
    const currentIndex = categoryTags.findIndex(
      (tag) => tag.id === categoryTagId,
    );

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= categoryTags.length) {
      return;
    }

    const categoryTag = categoryTags[currentIndex];
    const reorderedTags = categoryTags.filter(
      (tag) => tag.id !== categoryTagId,
    );
    reorderedTags.splice(nextIndex, 0, categoryTag);

    const previousTag = reorderedTags[nextIndex - 1] ?? null;
    const followingTag = reorderedTags[nextIndex + 1] ?? null;
    const updatedCategoryTag = touchCategoryTag(scope, {
      ...categoryTag,
      position: createSortRankBetween(
        previousTag?.position ?? null,
        followingTag?.position ?? null,
      ),
    });

    await persistCategoryTagUpdate(scope, updatedCategoryTag, ['position']);
  });
}

export async function softDeleteCategoryTag({
  scope,
  categoryTagId,
}: {
  scope: AppScope;
  categoryTagId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.dailyEntries,
      db.checklistItems,
      db.categoryTags,
      db.localPreferences,
      db.syncOutbox,
    ],
    async () => {
      const categoryTag = await db.categoryTags.get(categoryTagId);

      if (
        !categoryTag ||
        categoryTag.scopeId !== scope.id ||
        categoryTag.deletedAt
      ) {
        return;
      }

      const now = createTimestamp();
      const deletedCategoryTag = touchCategoryTag(scope, {
        ...categoryTag,
        deletedAt: now,
      });
      await persistCategoryTagUpdate(scope, deletedCategoryTag, ['deletedAt']);

      if (scope.kind === 'guest') {
        await clearGuestDefaultCategoryTagTracking(scope, categoryTag.id);
      }

      const affectedItems = await db.checklistItems
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (item) =>
            item.deletedAt === null && item.categoryTagId === categoryTag.id,
        )
        .toArray();
      const affectedDailyEntryIds = new Set<string>();

      for (const item of affectedItems) {
        affectedDailyEntryIds.add(item.dailyEntryId);
        const updatedItem = {
          ...item,
          categoryTagId: null,
          updatedAt: now,
          syncStatus: getEntitySyncStatus(scope),
          clientUpdatedAt: now,
        };

        await db.checklistItems.put(updatedItem);
        await queueSyncOutboxItem({
          scope,
          entityType: 'checklistItem',
          entityId: updatedItem.id,
          operation: 'upsert',
          payload: updatedItem as unknown as Record<string, unknown>,
          changedFields: ['categoryTagId'],
          baseRevision: updatedItem.remoteRevision,
        });
      }

      for (const dailyEntryId of affectedDailyEntryIds) {
        await recalculateDailyEntrySummary({ scope, dailyEntryId });
      }
    },
  );
}
