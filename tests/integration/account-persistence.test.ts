import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createCategoryTag,
  createChecklistItem,
  createGoal,
  createGoalGroup,
  createGoalStep,
  db,
  openOrCreateDailyEntry,
  toggleChecklistItemBold,
  toggleChecklistItemChecked,
  toggleGoalStepBold,
  toggleGoalStepChecked,
} from '@/lib/db';
import { waitForAccountPersistence } from '@/lib/db/account-persistence';
import { refreshAccountCache } from '@/lib/supabase/account-cache';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

interface RemoteWrite {
  table: string;
  payload: Record<string, unknown>;
}

function createAccountWriteClient() {
  const writes: RemoteWrite[] = [];
  const from = vi.fn((table: string) => ({
    upsert: vi.fn((payload: Record<string, unknown>) => {
      writes.push({ table, payload });

      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { revision: writes.length },
            error: null,
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

describe('account persistence boundaries', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('keeps guest writes local and away from Supabase', async () => {
    const scope = createGuestScope('local-only');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Local item',
    });
    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const goal = await createGoal({
      scope,
      category: 'short',
      title: 'Local goal',
    });
    const goalGroup = await createGoalGroup({
      scope,
      title: 'Local group',
    });
    const goalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Local goal step',
    });

    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.goalGroups.get(goalGroup.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.goalSteps.get(goalStep.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
  });

  it('persists authenticated writes directly to Supabase with the account owner id', async () => {
    const scope = createUserScope('cloud-user');
    const accountClient = createAccountWriteClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      accountClient.client,
    );

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
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Cloud item',
    });
    const goal = await createGoal({
      scope,
      category: 'short',
      title: 'Cloud goal',
    });
    const goalGroup = await createGoalGroup({
      scope,
      title: 'Cloud group',
    });
    const goalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Cloud goal step',
    });
    await toggleChecklistItemChecked({ scope, itemId: item.id });
    await toggleChecklistItemChecked({ scope, itemId: item.id });
    await toggleChecklistItemBold({ scope, itemId: item.id });
    await toggleGoalStepChecked({ scope, goalStepId: goalStep.id });
    await toggleGoalStepChecked({ scope, goalStepId: goalStep.id });
    await toggleGoalStepBold({ scope, goalStepId: goalStep.id });
    await waitForAccountPersistence(scope.id);

    expect(accountClient.writes.map((write) => write.table)).toEqual(
      expect.arrayContaining([
        'category_tags',
        'daily_entries',
        'checklist_items',
        'goal_groups',
        'goals',
        'goal_steps',
      ]),
    );
    expect(
      accountClient.writes.every(
        (write) => write.payload.user_id === scope.ownerId,
      ),
    ).toBe(true);
    expect(
      accountClient.writes.some(
        (write) =>
          write.table === 'checklist_items' &&
          write.payload.ignored === true &&
          write.payload.checked === false,
      ),
    ).toBe(true);
    expect(
      accountClient.writes.some(
        (write) =>
          write.table === 'checklist_items' && write.payload.bold === true,
      ),
    ).toBe(true);
    expect(
      accountClient.writes.some(
        (write) => write.table === 'goal_steps' && write.payload.bold === true,
      ),
    ).toBe(true);
    expect(
      accountClient.writes.some(
        (write) =>
          write.table === 'goal_steps' &&
          write.payload.ignored === true &&
          write.payload.completed === false,
      ),
    ).toBe(true);
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(db.goalGroups.get(goalGroup.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
    await expect(db.goalSteps.get(goalStep.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });
  });

  it('commits authenticated cache writes before a delayed Supabase response', async () => {
    const scope = createUserScope('slow-cloud-user');
    let resolveWrite!: (value: {
      data: { revision: number };
      error: null;
    }) => void;
    const delayedWrite = new Promise<{
      data: { revision: number };
      error: null;
    }>((resolve) => {
      resolveWrite = resolve;
    });
    const from = vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(() => delayedWrite),
        })),
      })),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    const creation = createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const categoryTag = await creation;

    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      name: 'FOCUS',
      syncStatus: 'pending',
    });

    resolveWrite({ data: { revision: 1 }, error: null });
    await waitForAccountPersistence(scope.id);

    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'synced',
      remoteRevision: 1,
    });
  });

  it('preserves pending authenticated goals during account cache refresh', async () => {
    const scope = createUserScope('refresh-pending-goal-user');
    let resolveWrite!: (value: {
      data: { revision: number };
      error: null;
    }) => void;
    const delayedWrite = new Promise<{
      data: { revision: number };
      error: null;
    }>((resolve) => {
      resolveWrite = resolve;
    });
    const from = vi.fn((table: string) => {
      if (table === 'goals') {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(() => delayedWrite),
            })),
          })),
          select: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }

      return {
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { revision: 1 },
              error: null,
            }),
          })),
        })),
        select: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    const goal = await createGoal({
      scope,
      title: 'Pending goal',
    });

    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      title: 'PENDING GOAL',
      syncStatus: 'pending',
    });

    await refreshAccountCache(scope);

    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      title: 'PENDING GOAL',
      syncStatus: 'pending',
    });

    resolveWrite({ data: { revision: 1 }, error: null });
    await waitForAccountPersistence(scope.id);

    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      title: 'PENDING GOAL',
      syncStatus: 'synced',
      remoteRevision: 1,
    });
  });

  it('keeps newly created authenticated entities locally when Supabase persistence fails', async () => {
    const scope = createUserScope('cloud-failure-user');
    const from = vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'remote write failed' },
          }),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      })),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      name: 'FOCUS',
      syncStatus: 'failed',
    });
  });

  it('ignores a missing goal_groups table during account cache refresh', async () => {
    const scope = createUserScope('goal-groups-missing-user');
    const now = '2026-05-21T10:00:00.000Z';
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockResolvedValue(
        table === 'goal_groups'
          ? {
              data: null,
              error: {
                code: 'PGRST205',
                details: null,
                hint: null,
                message:
                  "Could not find the table 'public.goal_groups' in the schema cache",
              },
            }
          : {
              data:
                table === 'goals'
                  ? [
                      {
                        id: 'goal-1',
                        user_id: scope.ownerId,
                        group_id: null,
                        title: 'Pulled goal',
                        category_tag_id: null,
                        sort_rank: 'n',
                        completed_at: null,
                        created_at: now,
                        updated_at: now,
                        deleted_at: null,
                        client_updated_at: now,
                        revision: 1,
                      },
                    ]
                  : [],
              error: null,
            },
      ),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    await expect(refreshAccountCache(scope)).resolves.toBeUndefined();
    await expect(db.goals.get('goal-1')).resolves.toMatchObject({
      title: 'Pulled goal',
      syncStatus: 'synced',
    });
  });

  it('refreshes authenticated cache from Supabase without using a local outbox', async () => {
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

    await refreshAccountCache(scope);

    await expect(db.categoryTags.get('tag-1')).resolves.toMatchObject({
      name: 'FOCUS',
      scopeId: scope.id,
    });
    await expect(db.dailyEntries.get('day-1')).resolves.toMatchObject({
      previewText: '',
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
