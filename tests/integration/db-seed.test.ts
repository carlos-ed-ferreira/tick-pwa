import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createCategoryTag,
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

  it('seeds localized default categories once for a guest scope', async () => {
    const scope = createGuestScope('local-test');

    await seedDefaultCategoryTags(scope, 'pt-BR');
    await seedDefaultCategoryTags(scope, 'pt-BR');

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');

    expect(categoryTags.map((tag) => tag.name)).toEqual([
      'FOCO',
      'SAÚDE',
      'CASA',
    ]);
    expect(categoryTags).toHaveLength(3);
    expect(categoryTags.every((tag) => tag.syncStatus === 'local')).toBe(true);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
  });

  it('does not seed default categories for an authenticated user scope', async () => {
    const scope = createUserScope('user-test');

    await seedDefaultCategoryTags(scope, 'en');

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    expect(categoryTags).toHaveLength(0);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
  });

  it('backfills legacy guest defaults without creating duplicates and re-localizes tracked base tags', async () => {
    const scope = createGuestScope('legacy-guest');

    await createCategoryTag({
      scope,
      name: 'Focus',
      colorHex: '#2563eb',
    });
    await createCategoryTag({
      scope,
      name: 'Health',
      colorHex: '#16a34a',
    });
    await createCategoryTag({
      scope,
      name: 'Home',
      colorHex: '#d97706',
    });
    await createCategoryTag({
      scope,
      name: 'People',
      colorHex: '#db2777',
    });
    await createCategoryTag({
      scope,
      name: 'Custom',
      colorHex: '#111827',
    });

    await seedDefaultCategoryTags(scope, 'pt-BR');

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');

    expect(categoryTags.map((tag) => tag.name)).toEqual([
      'FOCO',
      'SAÚDE',
      'CASA',
      'CUSTOM',
    ]);
    expect(categoryTags).toHaveLength(4);
  });
});
