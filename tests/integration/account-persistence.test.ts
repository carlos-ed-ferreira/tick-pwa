import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createCategoryTag,
  createChecklistItem,
  createGoal,
  createGoalGroup,
  createGoalStep,
  db,
  getLocalPreference,
  openOrCreateDailyEntry,
  toggleChecklistItemBold,
  toggleChecklistItemChecked,
  toggleChecklistItemCollapsed,
  toggleGoalStepBold,
  toggleGoalStepChecked,
  softDeleteChecklistItem,
} from '@/lib/db';
import {
  getAccountSyncSummary,
  retryFailedAccountPersistence,
  waitForAccountPersistence,
} from '@/lib/db/account-persistence';
import { refreshAccountCache } from '@/lib/supabase/account-cache';
import {
  checklistItemFromRemote,
  type RemoteEntityTable,
  type RemoteChecklistItem,
} from '@/lib/supabase/entity-mappers';

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

function createRemoteChecklistItem(
  scope: ReturnType<typeof createUserScope>,
  index: number,
): RemoteChecklistItem {
  return {
    ...createRemoteBaseRow(scope, 'remote-item', index),
    daily_entry_id: 'remote-day',
    parent_id: null,
    text: `Remote item ${index}`,
    scheduled_time: null,
    checked: false,
    ignored: false,
    bold: false,
    priority: false,
    collapsed: false,
    category_tag_id: null,
    sort_rank: `rank-${index.toString().padStart(4, '0')}`,
  };
}

function createRemoteBaseRow(
  scope: ReturnType<typeof createUserScope>,
  prefix: string,
  index: number,
) {
  const timestamp = '2026-05-21T10:00:00.000Z';

  return {
    id: `${prefix}-${index.toString().padStart(4, '0')}`,
    user_id: scope.ownerId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    client_updated_at: timestamp,
    revision: index + 1,
  };
}

function createRemoteEntityRows(
  scope: ReturnType<typeof createUserScope>,
  count: number,
): Record<RemoteEntityTable, unknown[]> {
  return {
    category_tags: Array.from({ length: count }, (_, index) => ({
      ...createRemoteBaseRow(scope, 'remote-tag', index),
      name: `TAG ${index}`,
      color_hex: '#2563eb',
      position: `position-${index}`,
      surface: 'checklist_item',
      use_own_name: false,
    })),
    daily_entries: Array.from({ length: count }, (_, index) => ({
      ...createRemoteBaseRow(scope, 'remote-day', index),
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
      item_count: 0,
      completed_count: 0,
      category_tag_ids: [],
      category_summaries: [],
    })),
    checklist_items: Array.from({ length: count }, (_, index) =>
      createRemoteChecklistItem(scope, index),
    ),
    goal_groups: Array.from({ length: count }, (_, index) => ({
      ...createRemoteBaseRow(scope, 'remote-goal-group', index),
      title: `Remote goal group ${index}`,
      category_tag_id: null,
      sort_rank: `rank-${index.toString().padStart(4, '0')}`,
    })),
    goals: Array.from({ length: count }, (_, index) => ({
      ...createRemoteBaseRow(scope, 'remote-goal', index),
      group_id: null,
      title: `Remote goal ${index}`,
      due_date: null,
      category_tag_id: null,
      sort_rank: `rank-${index.toString().padStart(4, '0')}`,
      completed_at: null,
    })),
    goal_steps: Array.from({ length: count }, (_, index) => ({
      ...createRemoteBaseRow(scope, 'remote-goal-step', index),
      goal_id: 'remote-goal',
      parent_id: null,
      text: `Remote goal step ${index}`,
      completed: false,
      ignored: false,
      bold: false,
      priority: false,
      collapsed: false,
      category_tag_id: null,
      scheduled_date: null,
      sort_rank: `rank-${index.toString().padStart(4, '0')}`,
    })),
  };
}

function createPagedSelectQuery({
  error = null,
  orders = [],
  ranges = [],
  rows,
  table,
}: {
  error?: { code?: string; message: string } | null;
  orders?: Array<{ column: string; table: string }>;
  ranges?: Array<{ from: number; table: string; to: number }>;
  rows: unknown[];
  table: string;
}) {
  const query = {
    order: vi.fn((column: string) => {
      orders.push({ column, table });
      return query;
    }),
    range: vi.fn((fromIndex: number, toIndex: number) => {
      ranges.push({ from: fromIndex, table, to: toIndex });

      return Promise.resolve({
        data: error ? null : rows.slice(fromIndex, toIndex + 1),
        error,
      });
    }),
  };

  return query;
}

function createPagedAccountReadClient({
  rowsByTable,
  failingPage,
}: {
  rowsByTable: Record<string, unknown[]>;
  failingPage?: { table: string; from: number };
}) {
  const ranges: Array<{ from: number; table: string; to: number }> = [];
  const orders: Array<{ column: string; table: string }> = [];
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      if (table === 'user_preferences' && columns === 'key,value') {
        return Promise.resolve({
          data: rowsByTable[table] ?? [],
          error: null,
        });
      }

      const query = createPagedSelectQuery({
        orders,
        ranges,
        rows: rowsByTable[table] ?? [],
        table,
      });

      if (failingPage?.table === table) {
        query.range.mockImplementation((fromIndex, toIndex) => {
          ranges.push({ from: fromIndex, table, to: toIndex });

          if (failingPage.from === fromIndex) {
            return Promise.resolve({
              data: null,
              error: { message: 'remote page failed' },
            });
          }

          return Promise.resolve({
            data: (rowsByTable[table] ?? []).slice(fromIndex, toIndex + 1),
            error: null,
          });
        });
      }

      return query;
    }),
  }));

  return { client: { from }, from, orders, ranges };
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

    await vi.waitFor(async () => {
      await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
        name: 'FOCUS',
        syncStatus: 'syncing',
      });
    });

    resolveWrite({ data: { revision: 1 }, error: null });
    await waitForAccountPersistence(scope.id);

    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'synced',
      remoteRevision: 1,
    });
  });

  it('does not let an older successful write mark a newer local change as synced', async () => {
    const scope = createUserScope('concurrent-success-user');
    const pendingWrites: Array<
      (value: { data: { revision: number }; error: null }) => void
    > = [];
    let delayChecklistWrites = false;
    const from = vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(() => {
            if (!delayChecklistWrites) {
              return Promise.resolve({
                data: { revision: 1 },
                error: null,
              });
            }

            return new Promise<{
              data: { revision: number };
              error: null;
            }>((resolve) => pendingWrites.push(resolve));
          }),
        })),
      })),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Concurrent item',
    });
    await waitForAccountPersistence(scope.id);
    delayChecklistWrites = true;

    await toggleChecklistItemCollapsed({ scope, itemId: item.id });
    await vi.waitFor(() => expect(pendingWrites).toHaveLength(1));
    await toggleChecklistItemBold({ scope, itemId: item.id });

    pendingWrites[0]({ data: { revision: 2 }, error: null });
    await vi.waitFor(() => expect(pendingWrites).toHaveLength(2));
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      bold: true,
      collapsed: true,
      syncStatus: 'syncing',
    });
    pendingWrites[1]({ data: { revision: 3 }, error: null });
    await waitForAccountPersistence(scope.id);

    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      bold: true,
      collapsed: true,
      remoteRevision: 3,
      syncStatus: 'synced',
    });
  });

  it('does not restore an older failed write over a queued deletion', async () => {
    const scope = createUserScope('concurrent-delete-user');
    let failNextChecklistWrite = false;
    let resolveFailedWrite!: (value: {
      data: null;
      error: { message: string };
    }) => void;
    const failedWrite = new Promise<{
      data: null;
      error: { message: string };
    }>((resolve) => {
      resolveFailedWrite = resolve;
    });
    const selectRemote = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'item-concurrent-delete',
            user_id: scope.ownerId,
            daily_entry_id: 'unused',
            parent_id: null,
            text: 'Remote stale item',
            scheduled_time: null,
            checked: false,
            ignored: false,
            bold: false,
            priority: false,
            collapsed: false,
            category_tag_id: null,
            sort_rank: 'U',
            created_at: '2026-05-21T10:00:00.000Z',
            updated_at: '2026-05-21T10:00:00.000Z',
            deleted_at: null,
            client_updated_at: '2026-05-21T10:00:00.000Z',
            revision: 1,
          },
          error: null,
        }),
      })),
    }));
    const from = vi.fn((table: string) => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(() => {
            if (table === 'checklist_items' && failNextChecklistWrite) {
              failNextChecklistWrite = false;
              return failedWrite;
            }

            return Promise.resolve({
              data: { revision: 3 },
              error: null,
            });
          }),
        })),
      })),
      select: selectRemote,
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      id: 'item-concurrent-delete',
      text: 'Delete me',
    });
    await waitForAccountPersistence(scope.id);
    failNextChecklistWrite = true;

    await toggleChecklistItemCollapsed({ scope, itemId: item.id });
    await softDeleteChecklistItem({ scope, itemId: item.id });
    resolveFailedWrite({
      data: null,
      error: { message: 'older write failed' },
    });
    await waitForAccountPersistence(scope.id);

    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      deletedAt: expect.any(String),
      syncStatus: 'synced',
    });
    expect(selectRemote).not.toHaveBeenCalled();
  });

  it('preserves in-flight authenticated goals during account cache refresh', async () => {
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
          select: vi.fn(() => createPagedSelectQuery({ rows: [], table })),
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
        select: vi.fn((columns: string) =>
          table === 'user_preferences' && columns === 'key,value'
            ? Promise.resolve({ data: [], error: null })
            : createPagedSelectQuery({ rows: [], table }),
        ),
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
      syncStatus: 'syncing',
    });

    resolveWrite({ data: { revision: 1 }, error: null });
    await waitForAccountPersistence(scope.id);

    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      title: 'PENDING GOAL',
      syncStatus: 'synced',
      remoteRevision: 1,
    });
  });

  it('loads every account table beyond the remote row limit with stable pagination', async () => {
    const scope = createUserScope('paginated-snapshot-user');
    const rowsByTable = createRemoteEntityRows(scope, 1001);
    const accountClient = createPagedAccountReadClient({
      rowsByTable,
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      accountClient.client,
    );

    const result = await refreshAccountCache(scope);

    await expect(
      Promise.all([
        db.categoryTags.where('scopeId').equals(scope.id).count(),
        db.dailyEntries.where('scopeId').equals(scope.id).count(),
        db.checklistItems.where('scopeId').equals(scope.id).count(),
        db.goalGroups.where('scopeId').equals(scope.id).count(),
        db.goals.where('scopeId').equals(scope.id).count(),
        db.goalSteps.where('scopeId').equals(scope.id).count(),
      ]),
    ).resolves.toEqual([1001, 1001, 1001, 1001, 1001, 1001]);

    for (const table of Object.keys(rowsByTable)) {
      expect(
        accountClient.ranges.filter((range) => range.table === table),
      ).toEqual([
        { from: 0, table, to: 999 },
        { from: 1000, table, to: 1999 },
      ]);
      expect(
        accountClient.orders.filter((order) => order.table === table),
      ).toEqual([
        { column: 'revision', table },
        { column: 'id', table },
        { column: 'revision', table },
        { column: 'id', table },
      ]);
    }

    expect(result).toMatchObject({
      tables: {
        category_tags: { pages: 2, rows: 1001 },
        daily_entries: { pages: 2, rows: 1001 },
        checklist_items: { pages: 2, rows: 1001 },
        goal_groups: { pages: 2, rows: 1001 },
        goals: { pages: 2, rows: 1001 },
        goal_steps: { pages: 2, rows: 1001 },
      },
      totalPages: 12,
      totalRows: 6006,
    });
  });

  it('does not reconcile any account table when a final snapshot page fails', async () => {
    const scope = createUserScope('failed-final-page-user');
    const localOnlyRow = createRemoteChecklistItem(scope, 2000);
    localOnlyRow.id = 'local-synced-item';
    await db.checklistItems.put(checklistItemFromRemote(scope, localOnlyRow));
    const accountClient = createPagedAccountReadClient({
      rowsByTable: {
        checklist_items: Array.from({ length: 1000 }, (_, index) =>
          createRemoteChecklistItem(scope, index),
        ),
      },
      failingPage: { table: 'checklist_items', from: 1000 },
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      accountClient.client,
    );

    await expect(refreshAccountCache(scope)).rejects.toMatchObject({
      message: 'remote page failed',
    });

    await expect(db.checklistItems.get('local-synced-item')).resolves.toEqual(
      checklistItemFromRemote(scope, localOnlyRow),
    );
    await expect(
      db.checklistItems.where('scopeId').equals(scope.id).count(),
    ).resolves.toBe(1);
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

  it('retries a failed authenticated creation with the same local entity', async () => {
    const scope = createUserScope('retry-failure-user');
    let shouldFail = true;
    let resolveRetry!: (value: {
      data: { revision: number };
      error: null;
    }) => void;
    const delayedRetry = new Promise<{
      data: { revision: number };
      error: null;
    }>((resolve) => {
      resolveRetry = resolve;
    });
    const writes: Record<string, unknown>[] = [];
    const from = vi.fn(() => ({
      upsert: vi.fn((payload: Record<string, unknown>) => {
        writes.push(payload);

        return {
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              shouldFail
                ? Promise.resolve({
                    data: null,
                    error: { message: 'remote write failed' },
                  })
                : delayedRetry,
            ),
          })),
        };
      }),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);
    shouldFail = false;

    const retry = retryFailedAccountPersistence(scope);

    await vi.waitFor(async () => {
      await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
        syncStatus: 'syncing',
      });
    });
    resolveRetry({ data: { revision: 7 }, error: null });
    await retry;

    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      name: 'FOCUS',
      remoteRevision: 7,
      syncStatus: 'synced',
    });
    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ id: categoryTag.id });
  });

  it('summarizes account sync states with failure-first priority', async () => {
    const scope = createUserScope('sync-summary-user');
    const from = vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'remote write failed' },
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

    await expect(getAccountSyncSummary(scope.id)).resolves.toEqual({
      state: 'failed',
      failedCount: 1,
      pendingCount: 0,
      syncingCount: 0,
    });

    await db.categoryTags.update(categoryTag.id, { syncStatus: 'pending' });
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'pending',
      failedCount: 0,
      pendingCount: 1,
    });

    await db.categoryTags.update(categoryTag.id, { syncStatus: 'syncing' });
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'syncing',
      pendingCount: 0,
      syncingCount: 1,
    });

    await db.categoryTags.update(categoryTag.id, { syncStatus: 'synced' });
    await expect(getAccountSyncSummary(scope.id)).resolves.toEqual({
      state: 'saved',
      failedCount: 0,
      pendingCount: 0,
      syncingCount: 0,
    });
  });

  it('ignores a missing goal_groups table during account cache refresh', async () => {
    const scope = createUserScope('goal-groups-missing-user');
    const now = '2026-05-21T10:00:00.000Z';
    const goalRows = [
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
    ];
    const from = vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        if (table === 'user_preferences' && columns === 'key,value') {
          return Promise.resolve({ data: [], error: null });
        }

        return createPagedSelectQuery({
          error:
            table === 'goal_groups'
              ? {
                  code: 'PGRST205',
                  message:
                    "Could not find the table 'public.goal_groups' in the schema cache",
                }
              : null,
          rows: table === 'goals' ? goalRows : [],
          table,
        });
      }),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    await expect(refreshAccountCache(scope)).resolves.toMatchObject({
      tables: { goal_groups: { pages: 1, rows: 0 } },
    });
    await expect(db.goals.get('goal-1')).resolves.toMatchObject({
      title: 'Pulled goal',
      syncStatus: 'synced',
    });
  });

  it('refreshes authenticated cache from Supabase without using a local outbox', async () => {
    const scope = createUserScope('sync-user');
    const now = '2026-05-21T10:00:00.000Z';
    const remoteRows: Record<string, unknown[]> = {
      user_preferences: [
        {
          user_id: scope.ownerId,
          key: 'taskTreeRowActions',
          value: { add: 'menu', priority: 'inline' },
          created_at: now,
          updated_at: now,
        },
      ],
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
      select: vi.fn((columns: string) =>
        table === 'user_preferences' && columns === 'key,value'
          ? Promise.resolve({
              data: remoteRows[table] ?? [],
              error: null,
            })
          : createPagedSelectQuery({
              rows: remoteRows[table] ?? [],
              table,
            }),
      ),
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
    await expect(
      getLocalPreference('taskTreeRowActions', scope),
    ).resolves.toEqual({
      add: 'menu',
      priority: 'inline',
    });
  });
});
