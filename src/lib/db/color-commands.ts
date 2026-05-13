import type { AppScope, ColorTag } from '@/lib/domain';
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
import { queueSyncOutboxItem } from './sync-outbox';

function normalizeHex(hex: string): string {
  const normalizedHex = hex.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return normalizedHex.toLowerCase();
  }

  return '#71717a';
}

async function getActiveColorTags(scope: AppScope): Promise<ColorTag[]> {
  const colorTags = await db.colorTags
    .where('scopeId')
    .equals(scope.id)
    .filter((tag) => tag.deletedAt === null)
    .toArray();

  return colorTags.sort((firstTag, secondTag) =>
    compareSortRanks(firstTag.position, secondTag.position),
  );
}

async function persistColorTagUpdate(
  scope: AppScope,
  colorTag: ColorTag,
  changedFields: string[],
): Promise<void> {
  await db.colorTags.put(colorTag);
  await queueSyncOutboxItem({
    scope,
    entityType: 'colorTag',
    entityId: colorTag.id,
    operation: colorTag.deletedAt ? 'delete' : 'upsert',
    payload: colorTag as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: colorTag.remoteRevision,
  });
}

function touchColorTag(scope: AppScope, colorTag: ColorTag): ColorTag {
  const now = createTimestamp();

  return {
    ...colorTag,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

export async function createColorTag({
  scope,
  name,
  hex,
}: {
  scope: AppScope;
  name: string;
  hex: string;
}): Promise<ColorTag> {
  return db.transaction('rw', db.colorTags, db.syncOutbox, async () => {
    const colorTags = await getActiveColorTags(scope);
    const now = createTimestamp();
    const colorTag: ColorTag = {
      id: createId(),
      scopeId: scope.id,
      name: name.trim() || 'Color',
      hex: normalizeHex(hex),
      position: createSortRankBetween(colorTags.at(-1)?.position ?? null, null),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.colorTags.add(colorTag);
    await queueSyncOutboxItem({
      scope,
      entityType: 'colorTag',
      entityId: colorTag.id,
      operation: 'upsert',
      payload: colorTag as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    return colorTag;
  });
}

export async function updateColorTag({
  scope,
  colorTagId,
  name,
  hex,
}: {
  scope: AppScope;
  colorTagId: string;
  name?: string;
  hex?: string;
}): Promise<void> {
  await db.transaction('rw', db.colorTags, db.syncOutbox, async () => {
    const colorTag = await db.colorTags.get(colorTagId);

    if (!colorTag || colorTag.scopeId !== scope.id || colorTag.deletedAt) {
      return;
    }

    const updatedColorTag = touchColorTag(scope, {
      ...colorTag,
      name: name === undefined ? colorTag.name : name.trim() || colorTag.name,
      hex: hex === undefined ? colorTag.hex : normalizeHex(hex),
    });
    const changedFields = [
      ...(name === undefined ? [] : ['name']),
      ...(hex === undefined ? [] : ['hex']),
    ];

    if (changedFields.length === 0) {
      return;
    }

    await persistColorTagUpdate(scope, updatedColorTag, changedFields);
  });
}

export async function reorderColorTag({
  scope,
  colorTagId,
  direction,
}: {
  scope: AppScope;
  colorTagId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction('rw', db.colorTags, db.syncOutbox, async () => {
    const colorTags = await getActiveColorTags(scope);
    const currentIndex = colorTags.findIndex((tag) => tag.id === colorTagId);

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= colorTags.length) {
      return;
    }

    const colorTag = colorTags[currentIndex];
    const reorderedTags = colorTags.filter((tag) => tag.id !== colorTagId);
    reorderedTags.splice(nextIndex, 0, colorTag);

    const previousTag = reorderedTags[nextIndex - 1] ?? null;
    const followingTag = reorderedTags[nextIndex + 1] ?? null;
    const updatedColorTag = touchColorTag(scope, {
      ...colorTag,
      position: createSortRankBetween(
        previousTag?.position ?? null,
        followingTag?.position ?? null,
      ),
    });

    await persistColorTagUpdate(scope, updatedColorTag, ['position']);
  });
}

export async function softDeleteColorTag({
  scope,
  colorTagId,
}: {
  scope: AppScope;
  colorTagId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.colorTags,
    db.syncOutbox,
    async () => {
      const colorTag = await db.colorTags.get(colorTagId);

      if (!colorTag || colorTag.scopeId !== scope.id || colorTag.deletedAt) {
        return;
      }

      const now = createTimestamp();
      const deletedColorTag = touchColorTag(scope, {
        ...colorTag,
        deletedAt: now,
      });
      await persistColorTagUpdate(scope, deletedColorTag, ['deletedAt']);

      const affectedItems = await db.checklistItems
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (item) => item.deletedAt === null && item.colorTagId === colorTag.id,
        )
        .toArray();
      const affectedDailyEntryIds = new Set<string>();

      for (const item of affectedItems) {
        affectedDailyEntryIds.add(item.dailyEntryId);
        const updatedItem = {
          ...item,
          colorTagId: null,
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
          changedFields: ['colorTagId'],
          baseRevision: updatedItem.remoteRevision,
        });
      }

      for (const dailyEntryId of affectedDailyEntryIds) {
        await recalculateDailyEntrySummary({ scope, dailyEntryId });
      }
    },
  );
}
