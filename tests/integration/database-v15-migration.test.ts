import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV14 = {
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
  createdAt: '2026-08-06T10:00:00.000Z',
  updatedAt: '2026-08-06T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'local',
  remoteRevision: null,
  clientUpdatedAt: '2026-08-06T10:00:00.000Z',
};

describe('Dexie goal date migrations', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('backfills a null due date and scheduled date on existing goals and goal steps', async () => {
    const legacy = new Dexie('tick');
    legacy.version(14).stores(storesV14);
    await legacy.open();
    await legacy.table('goals').add({
      ...metadata,
      id: 'legacy-goal',
      groupId: null,
      category: 'now',
      title: 'Existing goal',
      description: '',
      status: 'active',
      progressMode: 'steps',
      progressValue: 0,
      categoryTagId: null,
      sortRank: 'U',
      archivedAt: null,
      completedAt: null,
    });
    await legacy.table('goalSteps').add({
      ...metadata,
      id: 'legacy-step',
      goalId: 'legacy-goal',
      parentId: null,
      text: 'Existing step',
      completed: false,
      ignored: false,
      bold: false,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      sortRank: 'U',
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(migrated.goals.get('legacy-goal')).resolves.toMatchObject({
      dueDate: null,
    });
    await expect(migrated.goalSteps.get('legacy-step')).resolves.toMatchObject({
      scheduledDate: null,
    });
    migrated.close();
  });
});
