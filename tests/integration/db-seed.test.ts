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

    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');
    await seedDefaultCategoryTags(scope, 'pt-BR', 'goals');
    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');
    await seedDefaultCategoryTags(scope, 'pt-BR', 'goals');

    const calendarCategoryTags = await db.categoryTags
      .where('[scopeId+surface]')
      .equals([scope.id, 'calendar'])
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');
    const goalCategoryTags = await db.categoryTags
      .where('[scopeId+surface]')
      .equals([scope.id, 'goals'])
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');

    expect(calendarCategoryTags.map((tag) => tag.name)).toEqual([
      'FOCO',
      'SAÚDE',
      'CASA',
    ]);
    expect(goalCategoryTags.map((tag) => tag.name)).toEqual([
      'FOCO',
      'SAÚDE',
      'CASA',
    ]);
    expect(calendarCategoryTags).toHaveLength(3);
    expect(goalCategoryTags).toHaveLength(3);
    expect(
      [...calendarCategoryTags, ...goalCategoryTags].every(
        (tag) => tag.syncStatus === 'local',
      ),
    ).toBe(true);
  });

  it('does not seed default categories for an authenticated user scope', async () => {
    const scope = createUserScope('user-test');

    await seedDefaultCategoryTags(scope, 'en', 'calendar');

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    expect(categoryTags).toHaveLength(0);
  });

  it('backfills legacy guest defaults without creating duplicates and re-localizes tracked base tags', async () => {
    const scope = createGuestScope('legacy-guest');

    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Health',
      colorHex: '#16a34a',
    });
    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Home',
      colorHex: '#d97706',
    });
    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'People',
      colorHex: '#db2777',
    });
    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Custom',
      colorHex: '#111827',
    });

    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');

    const categoryTags = await db.categoryTags
      .where('[scopeId+surface]')
      .equals([scope.id, 'calendar'])
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
