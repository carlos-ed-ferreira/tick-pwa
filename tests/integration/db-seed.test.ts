import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import { db, getOrCreateInstallationId, seedDefaultColorTags } from '@/lib/db';

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

  it('seeds default color tags once for a guest scope', async () => {
    const scope = createGuestScope('local-test');

    await seedDefaultColorTags(scope);
    await seedDefaultColorTags(scope);

    const colorTags = await db.colorTags
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    expect(colorTags).toHaveLength(4);
    expect(colorTags.every((tag) => tag.syncStatus === 'local')).toBe(true);
  });
});
