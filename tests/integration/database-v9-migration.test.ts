import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV8 = {
  dailyEntries:
    'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
  checklistItems:
    'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
  colorTags:
    'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
  goals:
    'id, scopeId, category, status, updatedAt, deletedAt, [scopeId+category], [scopeId+status], [scopeId+updatedAt]',
  goalSteps:
    'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
  localPreferences: 'key, scopeId, updatedAt',
};

const metadata = {
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'local',
  remoteRevision: null,
  clientUpdatedAt: '2026-06-20T10:00:00.000Z',
};

describe('Dexie version 9 migration', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('converts guest goal containers and roots into groups and goals', async () => {
    const legacy = new Dexie('tick');
    legacy.version(8).stores(storesV8);
    await legacy.open();
    await legacy.table('goals').add({
      ...metadata,
      id: 'legacy-container',
      scopeId: 'guest:device',
      category: 'short',
      title: 'HEALTH',
      description: '',
      status: 'active',
      progressMode: 'steps',
      progressValue: 0,
      dueDate: null,
      categoryTagId: null,
      sortRank: 'a',
      archivedAt: null,
    });
    await legacy.table('goalSteps').bulkAdd([
      {
        ...metadata,
        id: 'legacy-root',
        scopeId: 'guest:device',
        goalId: 'legacy-container',
        parentId: null,
        text: 'Run',
        completed: false,
        priority: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: 'a',
      },
      {
        ...metadata,
        id: 'legacy-child',
        scopeId: 'guest:device',
        goalId: 'legacy-container',
        parentId: 'legacy-root',
        text: 'Buy shoes',
        completed: false,
        priority: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: 'a',
      },
    ]);
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(
      migrated.goalGroups.get('group:legacy-container'),
    ).resolves.toMatchObject({
      title: 'HEALTH',
    });
    await expect(migrated.goals.get('legacy-root')).resolves.toMatchObject({
      groupId: 'group:legacy-container',
      title: 'Run',
      completedAt: null,
    });
    await expect(migrated.goalSteps.get('legacy-child')).resolves.toMatchObject(
      {
        goalId: 'legacy-root',
        parentId: null,
      },
    );
    migrated.close();
  });

  it('clears incompatible authenticated functional cache', async () => {
    const legacy = new Dexie('tick');
    legacy.version(8).stores(storesV8);
    await legacy.open();
    await legacy.table('goals').add({
      ...metadata,
      id: 'remote-container',
      scopeId: 'user:account',
      category: 'short',
      title: 'REMOTE',
      description: '',
      status: 'active',
      progressMode: 'steps',
      progressValue: 0,
      dueDate: null,
      categoryTagId: null,
      sortRank: 'a',
      archivedAt: null,
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(migrated.goals.count()).resolves.toBe(0);
    await expect(migrated.goalGroups.count()).resolves.toBe(0);
    migrated.close();
  });
});
