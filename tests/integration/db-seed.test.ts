import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  db,
  getOrCreateInstallationId,
  seedDefaultCategoryTags,
} from '@/lib/db';

describe('local database bootstrap', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates a stable local installation id', async () => {
    const firstInstallationId = await getOrCreateInstallationId();
    const secondInstallationId = await getOrCreateInstallationId();

    expect(firstInstallationId).toBeTruthy();
    expect(secondInstallationId).toBe(firstInstallationId);
  });

  it('seeds default categories once for a guest scope', async () => {
    const scope = createGuestScope('local-test');

    await seedDefaultCategoryTags(scope);
    await seedDefaultCategoryTags(scope);

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    expect(categoryTags).toHaveLength(4);
    expect(categoryTags.every((tag) => tag.syncStatus === 'local')).toBe(true);
  });
});
