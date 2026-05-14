import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
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
    await expect(db.syncOutbox.count()).resolves.toBe(0);
  });

  it('queues default categories for an authenticated user scope', async () => {
    const scope = createUserScope('user-test');

    await seedDefaultCategoryTags(scope);
    await seedDefaultCategoryTags(scope);

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .toArray();
    const outboxItems = await db.syncOutbox.toArray();

    expect(categoryTags).toHaveLength(4);
    expect(categoryTags.every((tag) => tag.syncStatus === 'pending')).toBe(
      true,
    );
    expect(outboxItems).toHaveLength(4);
    expect(outboxItems.every((item) => item.entityType === 'categoryTag')).toBe(
      true,
    );
  });
});
