import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createCategoryTag,
  createDeterministicDailyEntryId,
  createChecklistItem,
  createGoal,
  createGoalStep,
  db,
  openOrCreateDailyEntry,
  queueSyncOutboxItem,
} from '@/lib/db';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

import { pushPendingChanges, synchronizeScope } from '@/lib/sync/sync-engine';

interface RemoteWrite {
  table: string;
  payload: Record<string, unknown>;
}

function createPushClient({
  error = null,
}: {
  error?: { message: string } | null;
} = {}) {
  const writes: RemoteWrite[] = [];
  const from = vi.fn((table: string) => ({
    upsert: vi.fn((payload: Record<string, unknown>) => {
      writes.push({ table, payload });

      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: error ? null : { revision: writes.length },
            error,
          }),
        })),
      };
    }),
  }));

  return {
    client: { from },
    from,
    writes,
  };
}

describe('sync engine', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('pushes authenticated outbox items in dependency order with the owner id', async () => {
    const scope = createUserScope('sync-user');
    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const checklistItem = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Cloud checklist item',
    });
    const goal = await createGoal({
      scope,
      category: 'short',
      title: 'Cloud goal',
    });
    const goalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Cloud goal step',
    });
    const pushClient = createPushClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(pushClient.client);

    await pushPendingChanges(scope);

    const tables = pushClient.writes.map((write) => write.table);
    expect(
      pushClient.writes.every(
        (write) => write.payload.user_id === scope.ownerId,
      ),
    ).toBe(true);
    expect(tables.indexOf('category_tags')).toBeLessThan(
      tables.indexOf('daily_entries'),
    );
    expect(tables.indexOf('daily_entries')).toBeLessThan(
      tables.indexOf('checklist_items'),
    );
    expect(tables.indexOf('goals')).toBeLessThan(tables.indexOf('goal_steps'));
    const outboxItems = await db.syncOutbox
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    expect(outboxItems.every((item) => item.status === 'synced')).toBe(true);
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(
      db.checklistItems.get(checklistItem.id),
    ).resolves.toMatchObject({ syncStatus: 'synced' });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(db.goalSteps.get(goalStep.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
  });

  it('uses deterministic daily entry ids for authenticated scopes', async () => {
    const scope = createUserScope('sync-user');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });

    expect(entry.id).toBe(
      createDeterministicDailyEntryId(scope.id, '2026-05-21'),
    );
  });

  it('does not contact Supabase when asked to push a guest scope', async () => {
    await pushPendingChanges(createGuestScope('local-only'));

    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it('marks failed authenticated pushes for retry', async () => {
    const scope = createUserScope('sync-failure-user');
    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const pushClient = createPushClient({
      error: { message: 'remote write failed' },
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(pushClient.client);

    await pushPendingChanges(scope);

    const outboxItem = await db.syncOutbox
      .where('scopeId')
      .equals(scope.id)
      .first();

    expect(outboxItem).toMatchObject({
      attempts: 1,
      lastError: 'remote write failed',
      status: 'failed',
    });
  });

  it('remaps legacy daily entries when the remote date already exists', async () => {
    const scope = createUserScope('sync-user');
    const now = '2026-05-21T10:00:00.000Z';
    const legacyEntry = {
      id: 'legacy-day',
      scopeId: scope.id,
      date: '2026-05-21' as const,
      timezone: 'America/Sao_Paulo',
      title: '',
      note: '',
      previewText: 'Legacy item',
      itemCount: 1,
      completedCount: 0,
      categoryTagIds: [],
      categorySummaries: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const,
      remoteRevision: null,
      clientUpdatedAt: now,
    };
    const legacyItem = {
      id: 'legacy-item',
      scopeId: scope.id,
      dailyEntryId: legacyEntry.id,
      parentId: null,
      text: 'Legacy item',
      checked: false,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      sortRank: 'n',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const,
      remoteRevision: null,
      clientUpdatedAt: now,
    };

    await db.dailyEntries.add(legacyEntry);
    await db.checklistItems.add(legacyItem);
    await queueSyncOutboxItem({
      scope,
      entityType: 'dailyEntry',
      entityId: legacyEntry.id,
      operation: 'upsert',
      payload: legacyEntry,
      changedFields: ['created'],
      baseRevision: null,
    });
    await queueSyncOutboxItem({
      scope,
      entityType: 'checklistItem',
      entityId: legacyItem.id,
      operation: 'upsert',
      payload: legacyItem,
      changedFields: ['created'],
      baseRevision: null,
    });

    const writes: RemoteWrite[] = [];
    const remoteDailyEntry = {
      id: 'remote-day',
      user_id: scope.ownerId,
      date: legacyEntry.date,
      timezone: legacyEntry.timezone,
      title: '',
      note: '',
      preview_text: '',
      item_count: 0,
      completed_count: 0,
      category_tag_ids: [],
      category_summaries: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      client_updated_at: now,
      revision: 7,
    };
    const dailyEntryQuery = {
      eq: vi.fn(() => dailyEntryQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: remoteDailyEntry,
        error: null,
      }),
    };
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => dailyEntryQuery),
      upsert: vi.fn((payload: Record<string, unknown>) => {
        writes.push({ table, payload });

        return {
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue(
              table === 'daily_entries'
                ? {
                    data: null,
                    error: {
                      code: '23505',
                      message:
                        'duplicate key value violates unique constraint "daily_entries_user_id_date_idx"',
                    },
                  }
                : { data: { revision: writes.length }, error: null },
            ),
          })),
        };
      }),
    }));

    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    await pushPendingChanges(scope);

    await expect(db.dailyEntries.get('legacy-day')).resolves.toBeUndefined();
    await expect(db.dailyEntries.get('remote-day')).resolves.toMatchObject({
      remoteRevision: 7,
      syncStatus: 'synced',
    });
    await expect(db.checklistItems.get('legacy-item')).resolves.toMatchObject({
      dailyEntryId: 'remote-day',
    });
    expect(
      writes.some(
        (write) =>
          write.table === 'checklist_items' &&
          write.payload.daily_entry_id === 'remote-day',
      ),
    ).toBe(true);
    await expect(
      db.syncOutbox.where('status').equals('failed').count(),
    ).resolves.toBe(0);
  });

  it('pulls calendar, checklist, category, goal, and goal step rows', async () => {
    const scope = createUserScope('sync-user');
    const now = '2026-05-21T10:00:00.000Z';
    const remoteRows: Record<string, unknown[]> = {
      category_tags: [
        {
          id: 'tag-1',
          user_id: scope.ownerId,
          name: 'FOCUS',
          color_hex: '#2563eb',
          position: 'n',
          surface: 'calendar',
          created_at: now,
          updated_at: now,
          deleted_at: null,
          client_updated_at: now,
          revision: 1,
        },
      ],
      daily_entries: [
        {
          id: 'day-1',
          user_id: scope.ownerId,
          date: '2026-05-21',
          timezone: 'America/Sao_Paulo',
          title: '',
          note: '',
          preview_text: 'Pulled item',
          item_count: 1,
          completed_count: 0,
          category_tag_ids: ['tag-1'],
          category_summaries: [
            { categoryTagId: 'tag-1', itemCount: 1, completedCount: 0 },
          ],
          created_at: now,
          updated_at: now,
          deleted_at: null,
          client_updated_at: now,
          revision: 1,
        },
      ],
      checklist_items: [
        {
          id: 'item-1',
          user_id: scope.ownerId,
          daily_entry_id: 'day-1',
          parent_id: null,
          text: 'Pulled item',
          checked: false,
          priority: false,
          collapsed: false,
          category_tag_id: 'tag-1',
          sort_rank: 'n',
          created_at: now,
          updated_at: now,
          deleted_at: null,
          client_updated_at: now,
          revision: 1,
        },
      ],
      goals: [
        {
          id: 'goal-1',
          user_id: scope.ownerId,
          category: 'short',
          title: 'Pulled goal',
          description: '',
          status: 'active',
          progress_mode: 'steps',
          progress_value: 0,
          due_date: null,
          category_tag_id: null,
          sort_rank: 'n',
          archived_at: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          client_updated_at: now,
          revision: 1,
        },
      ],
      goal_steps: [
        {
          id: 'goal-step-1',
          user_id: scope.ownerId,
          goal_id: 'goal-1',
          parent_id: null,
          text: 'Pulled goal step',
          completed: false,
          collapsed: false,
          category_tag_id: null,
          sort_rank: 'n',
          created_at: now,
          updated_at: now,
          deleted_at: null,
          client_updated_at: now,
          revision: 1,
        },
      ],
    };
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockResolvedValue({
        data: remoteRows[table] ?? [],
        error: null,
      }),
    }));

    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    await synchronizeScope(scope);

    await expect(db.categoryTags.get('tag-1')).resolves.toMatchObject({
      name: 'FOCUS',
      scopeId: scope.id,
    });
    await expect(db.dailyEntries.get('day-1')).resolves.toMatchObject({
      previewText: 'Pulled item',
      scopeId: scope.id,
    });
    await expect(db.checklistItems.get('item-1')).resolves.toMatchObject({
      dailyEntryId: 'day-1',
      scopeId: scope.id,
    });
    await expect(db.goals.get('goal-1')).resolves.toMatchObject({
      title: 'Pulled goal',
      scopeId: scope.id,
    });
    await expect(db.goalSteps.get('goal-step-1')).resolves.toMatchObject({
      goalId: 'goal-1',
      scopeId: scope.id,
    });
  });
});
