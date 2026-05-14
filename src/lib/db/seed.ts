import type { AppScope, CategoryTag, EntitySyncStatus } from '@/lib/domain';
import { createId, createSortRankBetween } from '@/lib/domain';
import { db } from './database';
import { queueSyncOutboxItem } from './sync-outbox';

const defaultCategoryTags = [
  { name: 'Focus', colorHex: '#2563eb' },
  { name: 'Health', colorHex: '#16a34a' },
  { name: 'Home', colorHex: '#d97706' },
  { name: 'People', colorHex: '#db2777' },
];

function createDefaultCategoryTag(
  scope: AppScope,
  tag: (typeof defaultCategoryTags)[number],
  position: string,
): CategoryTag {
  const now = new Date().toISOString();
  const syncStatus: EntitySyncStatus =
    scope.kind === 'guest' ? 'local' : 'pending';

  return {
    id: createId(),
    scopeId: scope.id,
    name: tag.name,
    colorHex: tag.colorHex,
    position,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus,
    remoteRevision: null,
    clientUpdatedAt: now,
  };
}

export async function seedDefaultCategoryTags(scope: AppScope): Promise<void> {
  const existingCount = await db.categoryTags
    .where('scopeId')
    .equals(scope.id)
    .filter((tag) => tag.deletedAt === null)
    .count();

  if (existingCount > 0) {
    return;
  }

  let previousPosition: string | null = null;
  const tags = defaultCategoryTags.map((tag) => {
    const position = createSortRankBetween(previousPosition, null);
    previousPosition = position;

    return createDefaultCategoryTag(scope, tag, position);
  });

  await db.transaction('rw', db.categoryTags, db.syncOutbox, async () => {
    await db.categoryTags.bulkAdd(tags);

    for (const tag of tags) {
      await queueSyncOutboxItem({
        scope,
        entityType: 'categoryTag',
        entityId: tag.id,
        operation: 'upsert',
        payload: tag as unknown as Record<string, unknown>,
        changedFields: ['created'],
        baseRevision: null,
      });
    }
  });
}
