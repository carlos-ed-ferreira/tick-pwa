import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  db,
  seedDefaultCategoryTags,
  seedGuestCategoryTags,
  softDeleteCategoryTag,
  updateCategoryTag,
} from '@/lib/db';

describe('guest default category lifecycle', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('renames tracked default categories when the guest locale changes', async () => {
    const scope = createGuestScope('guest-locale');

    await seedDefaultCategoryTags(scope, 'en', 'calendar');
    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');

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
  });

  it('does not overwrite manually renamed tracked guest categories on locale changes', async () => {
    const scope = createGuestScope('guest-rename');

    await seedDefaultCategoryTags(scope, 'en', 'calendar');

    const focusCategory = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null && tag.name === 'FOCUS')
      .first();

    expect(focusCategory).toBeTruthy();

    await updateCategoryTag({
      scope,
      categoryTagId: focusCategory!.id,
      name: 'Trabalho',
    });
    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');

    expect(categoryTags.map((tag) => tag.name)).toEqual([
      'Trabalho',
      'SAÚDE',
      'CASA',
    ]);
  });

  it('does not recreate deleted tracked guest categories during locale sync', async () => {
    const scope = createGuestScope('guest-delete');

    await seedDefaultCategoryTags(scope, 'en', 'calendar');

    const homeCategory = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null && tag.name === 'HOME')
      .first();

    expect(homeCategory).toBeTruthy();

    await softDeleteCategoryTag({
      scope,
      categoryTagId: homeCategory!.id,
    });
    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');

    const categoryTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');

    expect(categoryTags.map((tag) => tag.name)).toEqual(['FOCO', 'SAÚDE']);
    expect(categoryTags).toHaveLength(2);
  });

  it('removes the legacy tracked people category during guest reconciliation', async () => {
    const scope = createGuestScope('guest-remove-people');

    await db.categoryTags.bulkAdd([
      {
        id: 'focus',
        scopeId: scope.id,
        surface: 'calendar',
        name: 'FOCUS',
        colorHex: '#2563eb',
        position: 'U',
        useOwnName: false,
        createdAt: '2026-05-18T10:00:00.000Z',
        updatedAt: '2026-05-18T10:00:00.000Z',
        deletedAt: null,
        syncStatus: 'local',
        remoteRevision: null,
        clientUpdatedAt: '2026-05-18T10:00:00.000Z',
      },
      {
        id: 'health',
        scopeId: scope.id,
        surface: 'calendar',
        name: 'HEALTH',
        colorHex: '#16a34a',
        position: 'j',
        useOwnName: false,
        createdAt: '2026-05-18T10:00:00.000Z',
        updatedAt: '2026-05-18T10:00:00.000Z',
        deletedAt: null,
        syncStatus: 'local',
        remoteRevision: null,
        clientUpdatedAt: '2026-05-18T10:00:00.000Z',
      },
      {
        id: 'home',
        scopeId: scope.id,
        surface: 'calendar',
        name: 'HOME',
        colorHex: '#d97706',
        position: 'r',
        useOwnName: false,
        createdAt: '2026-05-18T10:00:00.000Z',
        updatedAt: '2026-05-18T10:00:00.000Z',
        deletedAt: null,
        syncStatus: 'local',
        remoteRevision: null,
        clientUpdatedAt: '2026-05-18T10:00:00.000Z',
      },
      {
        id: 'people',
        scopeId: scope.id,
        surface: 'calendar',
        name: 'PEOPLE',
        colorHex: '#db2777',
        position: 'z',
        useOwnName: false,
        createdAt: '2026-05-18T10:00:00.000Z',
        updatedAt: '2026-05-18T10:00:00.000Z',
        deletedAt: null,
        syncStatus: 'local',
        remoteRevision: null,
        clientUpdatedAt: '2026-05-18T10:00:00.000Z',
      },
    ]);

    await seedDefaultCategoryTags(scope, 'pt-BR', 'calendar');

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
  });
});

describe('guest default categories of every surface', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('seeds recurring categories apart from the other surfaces', async () => {
    const scope = createGuestScope('guest-recurring-seed');

    await seedGuestCategoryTags(scope, 'en');
    await seedGuestCategoryTags(scope, 'en');

    const recurring = await db.categoryTags
      .where('[scopeId+surface]')
      .equals([scope.id, 'recurrence'])
      .toArray();
    const daily = await db.categoryTags
      .where('[scopeId+surface]')
      .equals([scope.id, 'checklist_item'])
      .toArray();

    expect(recurring.length).toBeGreaterThan(0);
    expect(recurring).toHaveLength(daily.length);
    expect(
      recurring.some((tag) => daily.some((other) => other.id === tag.id)),
    ).toBe(false);
  });

  it('does not seed an account', async () => {
    const scope = createUserScope('account-recurring-seed');

    await seedGuestCategoryTags(scope, 'en');

    await expect(db.categoryTags.count()).resolves.toBe(0);
  });
});
