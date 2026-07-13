import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV10 = {
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
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'local',
  remoteRevision: null,
  clientUpdatedAt: '2026-06-20T10:00:00.000Z',
};

describe('Dexie version 11 migration', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('normalizes checklist items missing parentId and collapsed', async () => {
    const legacy = new Dexie('tick');
    legacy.version(10).stores(storesV10);
    await legacy.open();
    await legacy.table('checklistItems').add({
      ...metadata,
      id: 'legacy-item',
      scopeId: 'guest:device',
      dailyEntryId: 'entry-1',
      text: 'Created before nesting existed',
      checked: false,
      priority: false,
      categoryTagId: null,
      sortRank: 'U',
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(
      migrated.checklistItems.get('legacy-item'),
    ).resolves.toMatchObject({
      parentId: null,
      collapsed: false,
      scheduledTime: null,
    });
    migrated.close();
  });
});
