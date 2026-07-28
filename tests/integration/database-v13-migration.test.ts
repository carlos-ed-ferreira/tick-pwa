import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV12 = {
  dailyEntries:
    'id, scopeId, date, updatedAt, deletedAt, [scopeId+date], [scopeId+updatedAt]',
  checklistItems:
    'id, scopeId, dailyEntryId, parentId, updatedAt, deletedAt, [scopeId+dailyEntryId], [scopeId+parentId], [scopeId+updatedAt]',
  colorTags:
    'id, scopeId, surface, position, updatedAt, deletedAt, [scopeId+surface], [scopeId+surface+position], [scopeId+updatedAt]',
  goalGroups: 'id, scopeId, updatedAt, deletedAt, [scopeId+updatedAt]',
  goals:
    'id, scopeId, groupId, category, completedAt, updatedAt, deletedAt, [scopeId+groupId], [scopeId+category], [scopeId+completedAt], [scopeId+updatedAt]',
  goalSteps:
    'id, scopeId, goalId, parentId, updatedAt, deletedAt, [scopeId+goalId], [scopeId+parentId], [scopeId+updatedAt]',
  localPreferences: 'key, scopeId, updatedAt',
};

const metadata = {
  scopeId: 'guest:device',
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'local',
  remoteRevision: null,
  clientUpdatedAt: '2026-07-28T10:00:00.000Z',
};

describe('Dexie version 13 migration', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('defaults existing checklist items and goal steps to not ignored', async () => {
    const legacy = new Dexie('tick');
    legacy.version(12).stores(storesV12);
    await legacy.open();
    await legacy.table('checklistItems').add({
      ...metadata,
      id: 'legacy-item',
      dailyEntryId: 'entry-1',
      parentId: null,
      text: 'Existing task',
      scheduledTime: null,
      checked: false,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      sortRank: 'U',
    });
    await legacy.table('goalSteps').add({
      ...metadata,
      id: 'legacy-step',
      goalId: 'goal-1',
      parentId: null,
      text: 'Existing step',
      completed: false,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      sortRank: 'U',
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(
      migrated.checklistItems.get('legacy-item'),
    ).resolves.toMatchObject({ ignored: false });
    await expect(migrated.goalSteps.get('legacy-step')).resolves.toMatchObject({
      ignored: false,
    });
    migrated.close();
  });
});
