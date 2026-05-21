import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createCategoryTag,
  createChecklistItem,
  createGoal,
  createGoalStep,
  db,
  openOrCreateDailyEntry,
} from '@/lib/db';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

import { pushPendingChanges } from '@/lib/sync/sync-engine';

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

  it('does not contact Supabase when asked to push a guest scope', async () => {
    await pushPendingChanges(createGuestScope('local-only'));

    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it('marks failed authenticated pushes for retry', async () => {
    const scope = createUserScope('sync-failure-user');
    await createCategoryTag({
      scope,
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
});
