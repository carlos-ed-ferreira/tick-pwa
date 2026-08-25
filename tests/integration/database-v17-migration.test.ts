import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TickDatabase } from '@/lib/db/database';

const storesV16 = {
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

describe('Dexie outbox retry scheduling migration', () => {
  afterEach(async () => {
    await Dexie.delete('tick');
  });

  it('adds retry scheduling fields without losing queued operations', async () => {
    const legacy = new Dexie('tick');
    legacy.version(16).stores(storesV16);
    await legacy.open();
    await legacy.table('syncOutbox').add({
      id: 'queued-operation',
      scopeId: 'user:account-user',
      mutations: [
        {
          baseRevision: null,
          clientUpdatedAt: '2026-08-25T10:00:00.000Z',
          entityId: 'queued-tag',
          entityType: 'categoryTag',
          operation: 'upsert',
          payload: { id: 'queued-tag' },
        },
      ],
      createdAt: '2026-08-25T10:00:00.000Z',
      attempts: 2,
      lastAttemptAt: '2026-08-25T10:00:05.000Z',
      lastError: 'network_error',
      status: 'failed',
    });
    legacy.close();

    const migrated = new TickDatabase();
    await migrated.open();

    await expect(
      migrated.syncOutbox.get('queued-operation'),
    ).resolves.toMatchObject({
      attempts: 2,
      lastError: 'network_error',
      nextAttemptAt: null,
      rebasedAt: null,
      status: 'failed',
    });
    await expect(
      migrated.syncOutbox.get('queued-operation'),
    ).resolves.toHaveProperty('mutations.0.entityId', 'queued-tag');
    migrated.close();
  });
});
