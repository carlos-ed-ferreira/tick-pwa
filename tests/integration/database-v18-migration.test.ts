import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV17 = {
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
  syncOutbox:
    'id, scopeId, status, createdAt, [scopeId+status], [scopeId+createdAt]',
};

const now = '2026-08-26T10:00:00.000Z';

const baseFields = {
  scopeId: 'guest:legacy-device',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  syncStatus: 'local',
  remoteRevision: null,
  clientUpdatedAt: now,
};

describe('Dexie marking level migration', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('derives the marking level from the stored completion of tasks and steps', async () => {
    const legacy = new Dexie('tick');
    legacy.version(17).stores(storesV17);
    await legacy.open();
    await legacy.table('checklistItems').bulkAdd([
      {
        ...baseFields,
        id: 'completed-item',
        dailyEntryId: 'entry-1',
        parentId: null,
        text: 'Completed task',
        scheduledTime: null,
        checked: true,
        ignored: false,
        bold: false,
        priority: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: 'U',
      },
      {
        ...baseFields,
        id: 'ignored-item',
        dailyEntryId: 'entry-1',
        parentId: null,
        text: 'Ignored task',
        scheduledTime: null,
        checked: false,
        ignored: true,
        bold: false,
        priority: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: 'j',
      },
    ]);
    await legacy.table('goalSteps').add({
      ...baseFields,
      id: 'open-step',
      goalId: 'goal-1',
      parentId: null,
      text: 'Open step',
      completed: false,
      ignored: false,
      bold: false,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      scheduledDate: null,
      sortRank: 'U',
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(
      migrated.checklistItems.get('completed-item'),
    ).resolves.toMatchObject({ checked: true, ignored: false, markLevel: 1 });
    await expect(
      migrated.checklistItems.get('ignored-item'),
    ).resolves.toMatchObject({ checked: false, ignored: true, markLevel: 0 });
    await expect(migrated.goalSteps.get('open-step')).resolves.toMatchObject({
      completed: false,
      markLevel: 0,
    });
    migrated.close();
  });
});
