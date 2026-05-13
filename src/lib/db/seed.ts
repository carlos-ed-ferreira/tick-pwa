import type { AppScope, ColorTag, EntitySyncStatus } from '@/lib/domain';
import { createId, createSortRankBetween } from '@/lib/domain';
import { db } from './database';

const defaultColorTags = [
  { name: 'Focus', hex: '#2563eb' },
  { name: 'Health', hex: '#16a34a' },
  { name: 'Home', hex: '#d97706' },
  { name: 'People', hex: '#db2777' },
];

function createDefaultColorTag(
  scope: AppScope,
  tag: (typeof defaultColorTags)[number],
  position: string,
): ColorTag {
  const now = new Date().toISOString();
  const syncStatus: EntitySyncStatus =
    scope.kind === 'guest' ? 'local' : 'pending';

  return {
    id: createId(),
    scopeId: scope.id,
    name: tag.name,
    hex: tag.hex,
    position,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus,
    remoteRevision: null,
    clientUpdatedAt: now,
  };
}

export async function seedDefaultColorTags(scope: AppScope): Promise<void> {
  const existingCount = await db.colorTags
    .where('scopeId')
    .equals(scope.id)
    .filter((tag) => tag.deletedAt === null)
    .count();

  if (existingCount > 0) {
    return;
  }

  let previousPosition: string | null = null;
  const tags = defaultColorTags.map((tag) => {
    const position = createSortRankBetween(previousPosition, null);
    previousPosition = position;

    return createDefaultColorTag(scope, tag, position);
  });

  await db.colorTags.bulkAdd(tags);
}
