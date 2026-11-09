import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV18 = {
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

describe('Dexie recurrence migration', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('adds empty recurrence tables without changing entities or the outbox', async () => {
    const legacy = new Dexie('tick');
    legacy.version(18).stores(storesV18);
    await legacy.open();
    await legacy.table('colorTags').add({
      id: 'existing-tag',
      scopeId: 'user:account-user',
      name: 'EXISTING',
      colorHex: '#2563eb',
      position: 'a0',
      surface: 'checklist_item',
      useOwnName: false,
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      remoteRevision: 4,
      clientUpdatedAt: '2026-08-20T10:00:00.000Z',
    });
    await legacy.table('syncOutbox').add({
      id: 'pending-operation',
      scopeId: 'user:account-user',
      status: 'pending',
      createdAt: '2026-08-20T10:00:00.000Z',
      mutations: [],
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(
      migrated.categoryTags.get('existing-tag'),
    ).resolves.toMatchObject({ name: 'EXISTING', syncStatus: 'pending' });
    await expect(
      migrated.syncOutbox.get('pending-operation'),
    ).resolves.toMatchObject({ status: 'pending' });
    await expect(migrated.recurrences.count()).resolves.toBe(0);
    await expect(migrated.recurrenceResponses.count()).resolves.toBe(0);
    migrated.close();
  });
});
