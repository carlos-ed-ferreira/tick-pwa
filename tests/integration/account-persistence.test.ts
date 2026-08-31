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
  forceSyncAccount,
  getAccountSyncSummary,
  persistAccountEntityChange,
  resumeAccountPersistence,
  retryFailedAccountPersistence,
  waitForAccountPersistence,
} from '@/lib/db/account-persistence';
import { MAX_ACCOUNT_OUTBOX_OPERATIONS } from '@/lib/db/account-operation-outbox';
import { getAccountSyncMetrics } from '@/lib/db/account-sync-metrics';
import { refreshAccountCache } from '@/lib/supabase/account-cache';
import {
  checklistItemFromRemote,
  type RemoteEntityTable,
  type RemoteChecklistItem,
} from '@/lib/supabase/entity-mappers';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));
const environmentMocks = vi.hoisted(() => ({
  shouldUseAccountOperationBatchesForUser: vi.fn(() => false),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

vi.mock('@/lib/environment', () => ({
  shouldUseAccountOperationBatchesForUser:
    environmentMocks.shouldUseAccountOperationBatchesForUser,
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

function createSyncClient({
  remoteRevisions = {},
  snapshot = {},
}: {
  remoteRevisions?: Record<string, number>;
  snapshot?: Partial<Record<RemoteEntityTable, unknown[]>>;
} = {}) {
  const pushedIds: string[] = [];
  const rpc = vi.fn(
    async (
      _functionName: string,
      args: {
        p_mutations: Array<{
          base_revision: number | null;
          entity_type: string;
          payload: { id: string };
        }>;
        p_operation_id: string;
      },
    ) => {
      const stale = args.p_mutations.find(
        (mutation) =>
          (remoteRevisions[mutation.payload.id] ?? null) !==
          mutation.base_revision,
      );

      if (stale) {
        return {
          data: null,
          error: { code: '40001', message: 'stale_revision' },
        };
      }

      for (const mutation of args.p_mutations) {
        pushedIds.push(mutation.payload.id);
      }

      return {
        data: {
          operationId: args.p_operation_id,
          mutations: args.p_mutations.map((mutation) => ({
            entityType: mutation.entity_type,
            id: mutation.payload.id,
            revision: (remoteRevisions[mutation.payload.id] ?? 0) + 1,
          })),
        },
        error: null,
      };
    },
  );
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      if (table === 'user_preferences' && columns === 'key,value') {
        return Promise.resolve({ data: [], error: null });
      }

      if (columns === '*') {
        return createPagedSelectQuery({
          rows: snapshot[table as RemoteEntityTable] ?? [],
          table,
        });
      }

      return {
        eq: vi.fn(() => ({
          in: vi.fn(async (_column: string, ids: string[]) => ({
            data: ids
              .filter((id) => id in remoteRevisions)
              .map((id) => ({ id, revision: remoteRevisions[id] })),
            error: null,
          })),
        })),
      };
    }),
  }));

  return { client: { from, rpc }, pushedIds, rpc };
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
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      false,
    );
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('keeps guest writes local and away from Supabase', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
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
    await expect(db.syncOutbox.count()).resolves.toBe(0);
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
    const completionSettings = { ignored: true, levels: 1 };
    await toggleChecklistItemChecked({
      scope,
      itemId: item.id,
      completionSettings,
    });
    await toggleChecklistItemChecked({
      scope,
      itemId: item.id,
      completionSettings,
    });
    await toggleChecklistItemBold({ scope, itemId: item.id });
    await toggleGoalStepChecked({
      scope,
      goalStepId: goalStep.id,
      completionSettings,
    });
    await toggleGoalStepChecked({
      scope,
      goalStepId: goalStep.id,
      completionSettings,
    });
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
          write.table === 'checklist_items' &&
          write.payload.checked === true &&
          write.payload.mark_level === 1,
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

  it('persists a checklist transaction through one account operation RPC', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('batched-account-user');
    const accountClient = createAccountWriteClient();
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) => ({
        data: {
          operationId: args.p_operation_id,
          mutations: args.p_mutations.map((mutation, index) => ({
            entityType: mutation.entity_type,
            id: mutation.payload.id,
            revision: index + 1,
          })),
        },
        error: null,
      }),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      ...accountClient.client,
      rpc,
    });
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-20',
      timezone: 'America/Sao_Paulo',
    });
    await waitForAccountPersistence(scope.id);
    rpc.mockClear();
    accountClient.writes.length = 0;

    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Atomic task',
    });
    await waitForAccountPersistence(scope.id);

    expect(accountClient.writes).toHaveLength(0);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe('apply_account_operation_batch');
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_operation_id: expect.any(String),
      p_mutations: [
        { entity_type: 'checklistItem' },
        { entity_type: 'dailyEntry' },
      ],
    });
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      remoteRevision: 1,
      syncStatus: 'synced',
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      remoteRevision: 2,
      syncStatus: 'synced',
    });
  });

  it('retries a durable account operation with the same id after a lost response', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('durable-account-user');
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'network_error', message: 'response lost' },
      })
      .mockImplementation(
        async (
          _functionName: string,
          args: {
            p_mutations: Array<{
              entity_type: string;
              payload: { id: string };
            }>;
            p_operation_id: string;
          },
        ) => ({
          data: {
            operationId: args.p_operation_id,
            mutations: args.p_mutations.map((mutation) => ({
              entityType: mutation.entity_type,
              id: mutation.payload.id,
              revision: 7,
            })),
          },
          error: null,
        }),
      );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-20',
      timezone: 'America/Sao_Paulo',
    });
    await waitForAccountPersistence(scope.id);
    const failedOperation = await db.syncOutbox.toCollection().first();

    expect(failedOperation).toMatchObject({
      attempts: 1,
      status: 'failed',
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      syncStatus: 'failed',
    });
    const laterEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-21',
      timezone: 'America/Sao_Paulo',
    });
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledOnce();
    await expect(getAccountSyncSummary(scope.id)).resolves.toEqual({
      state: 'failed',
      failedCount: 1,
      pendingCount: 1,
      syncingCount: 0,
    });

    await retryFailedAccountPersistence(scope);

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[1][1].p_operation_id).toBe(
      rpc.mock.calls[0][1].p_operation_id,
    );
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      remoteRevision: 7,
      syncStatus: 'synced',
    });
    await expect(db.dailyEntries.get(laterEntry.id)).resolves.toMatchObject({
      remoteRevision: 7,
      syncStatus: 'synced',
    });
  });

  it('resumes an interrupted account operation after reload semantics', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('resumed-account-user');
    let allowSuccess = false;
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) =>
        allowSuccess
          ? {
              data: {
                operationId: args.p_operation_id,
                mutations: args.p_mutations.map((mutation) => ({
                  entityType: mutation.entity_type,
                  id: mutation.payload.id,
                  revision: 9,
                })),
              },
              error: null,
            }
          : {
              data: null,
              error: { code: 'network_error', message: 'offline' },
            },
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-21',
      timezone: 'America/Sao_Paulo',
    });
    await waitForAccountPersistence(scope.id);
    const operation = await db.syncOutbox.toCollection().first();
    allowSuccess = true;

    await resumeAccountPersistence(scope);

    expect(rpc.mock.calls[1][1].p_operation_id).toBe(operation!.id);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      remoteRevision: 9,
      syncStatus: 'synced',
    });
  });

  it('keeps a legacy offline write recoverable and resumes it after reconnect', async () => {
    const scope = createUserScope('legacy-reconnect-user');
    const accountClient = createAccountWriteClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      accountClient.client,
    );
    const online = vi
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(false);

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Offline focus',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    expect(accountClient.from).not.toHaveBeenCalled();
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'failed',
    });

    online.mockReturnValue(true);
    await resumeAccountPersistence(scope);

    expect(accountClient.from).toHaveBeenCalledOnce();
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      remoteRevision: 1,
      syncStatus: 'synced',
    });
    online.mockRestore();
  });

  it('keeps a durable offline write pending until the browser reconnects', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('durable-offline-user');
    const sync = createSyncClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);
    const online = vi
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(false);

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Offline durable',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    expect(sync.rpc).not.toHaveBeenCalled();
    await expect(db.syncOutbox.toCollection().first()).resolves.toMatchObject({
      attempts: 0,
      status: 'pending',
    });
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      failedCount: 0,
      pendingCount: 1,
      state: 'pending',
    });

    online.mockReturnValue(true);
    await resumeAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    expect(sync.rpc).toHaveBeenCalledOnce();
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      remoteRevision: 1,
      syncStatus: 'synced',
    });
    online.mockRestore();
  });

  it('returns an in-flight durable write to pending when the browser goes offline', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('durable-disconnect-user');
    let browserOnline = true;
    let requestCount = 0;
    const sync = createSyncClient();
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            base_revision: number | null;
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) => {
        requestCount += 1;

        if (requestCount === 1) {
          browserOnline = false;
          return {
            data: null,
            error: { code: 'network_error', message: 'offline' },
          };
        }

        return sync.rpc(_functionName, args);
      },
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      ...sync.client,
      rpc,
    });
    const online = vi
      .spyOn(window.navigator, 'onLine', 'get')
      .mockImplementation(() => browserOnline);

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Disconnect durable',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledOnce();
    await expect(db.syncOutbox.toCollection().first()).resolves.toMatchObject({
      status: 'pending',
    });
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });

    browserOnline = true;
    await resumeAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledTimes(2);
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      remoteRevision: 1,
      syncStatus: 'synced',
    });
    online.mockRestore();
  });

  it('keeps transport failures pending when the browser still reports online', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('stale-online-signal-user');
    const sync = createSyncClient();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '',
        details: 'TypeError: Failed to fetch',
        hint: '',
        message: 'TypeError: Failed to fetch',
      },
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });
    const online = vi
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(false);

    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'First transport failure',
      colorHex: '#2563eb',
    });
    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Second transport failure',
      colorHex: '#16a34a',
    });
    await waitForAccountPersistence(scope.id);
    online.mockReturnValue(true);

    await resumeAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledOnce();
    await expect(db.syncOutbox.orderBy('createdAt').toArray()).resolves.toEqual(
      [
        expect.objectContaining({
          attempts: 1,
          nextAttemptAt: expect.any(String),
          status: 'pending',
        }),
        expect.objectContaining({ attempts: 0, status: 'pending' }),
      ],
    );
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      failedCount: 0,
      pendingCount: 2,
      state: 'pending',
    });
    await expect(getAccountSyncMetrics(scope.id)).resolves.toMatchObject({
      lastBatchMutationCount: 1,
      lastBatchResult: 'transport_unavailable',
      transportFailures: 1,
    });

    rpc.mockImplementation(sync.rpc);
    await retryFailedAccountPersistence(scope);

    expect(rpc).toHaveBeenCalledTimes(3);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    online.mockRestore();
  });

  it('uses the durable RPC path for categories and the complete goal hierarchy', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('goal-batch-user');
    const accountClient = createAccountWriteClient();
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) => ({
        data: {
          operationId: args.p_operation_id,
          mutations: args.p_mutations.map((mutation) => ({
            entityType: mutation.entity_type,
            id: mutation.payload.id,
            revision: 3,
          })),
        },
        error: null,
      }),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      ...accountClient.client,
      rpc,
    });

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'goals',
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const goalGroup = await createGoalGroup({ scope, title: 'Group' });
    const goal = await createGoal({
      scope,
      groupId: goalGroup.id,
      title: 'Goal',
    });
    const goalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Step',
    });
    await waitForAccountPersistence(scope.id);

    expect(accountClient.writes).toHaveLength(0);
    expect(
      rpc.mock.calls.flatMap(
        (call) => call[1].p_mutations as Array<{ entity_type: string }>,
      ),
    ).toEqual([
      expect.objectContaining({ entity_type: 'categoryTag' }),
      expect.objectContaining({ entity_type: 'goalGroup' }),
      expect.objectContaining({ entity_type: 'goal' }),
      expect.objectContaining({ entity_type: 'goalStep' }),
    ]);
    await expect(
      Promise.all([
        db.categoryTags.get(categoryTag.id),
        db.goalGroups.get(goalGroup.id),
        db.goals.get(goal.id),
        db.goalSteps.get(goalStep.id),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ remoteRevision: 3, syncStatus: 'synced' }),
      expect.objectContaining({ remoteRevision: 3, syncStatus: 'synced' }),
      expect.objectContaining({ remoteRevision: 3, syncStatus: 'synced' }),
      expect.objectContaining({ remoteRevision: 3, syncStatus: 'synced' }),
    ]);
  });

  it('rebases a newer queued mutation after the previous revision is acknowledged', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('rebased-account-user');
    let delayNextOperation = false;
    let resolveDelayedOperation!: (value: {
      data: {
        operationId: string;
        mutations: Array<{
          entityType: string;
          id: string;
          revision: number;
        }>;
      };
      error: null;
    }) => void;
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) => {
        if (delayNextOperation) {
          delayNextOperation = false;
          return new Promise((resolve) => {
            resolveDelayedOperation = resolve;
          });
        }

        return {
          data: {
            operationId: args.p_operation_id,
            mutations: args.p_mutations.map((mutation, index) => ({
              entityType: mutation.entity_type,
              id: mutation.payload.id,
              revision: rpc.mock.calls.length + index,
            })),
          },
          error: null,
        };
      },
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-22',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Rebase me',
    });
    await waitForAccountPersistence(scope.id);
    rpc.mockClear();
    delayNextOperation = true;

    await toggleChecklistItemCollapsed({ scope, itemId: item.id });
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    await toggleChecklistItemBold({ scope, itemId: item.id });
    const firstOperation = rpc.mock.calls[0][1];
    resolveDelayedOperation({
      data: {
        operationId: firstOperation.p_operation_id,
        mutations: firstOperation.p_mutations.map(
          (mutation: { entity_type: string; payload: { id: string } }) => ({
            entityType: mutation.entity_type,
            id: mutation.payload.id,
            revision: 10,
          }),
        ),
      },
      error: null,
    });
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1].p_mutations[0]).toMatchObject({
      base_revision: 10,
      entity_type: 'checklistItem',
    });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      bold: true,
      collapsed: true,
      syncStatus: 'synced',
    });
  });

  it('splits a large local transaction into bounded ordered RPC batches', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('bounded-batch-user');
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) => ({
        data: {
          operationId: args.p_operation_id,
          mutations: args.p_mutations.map((mutation) => ({
            entityType: mutation.entity_type,
            id: mutation.payload.id,
            revision: 1,
          })),
        },
        error: null,
      }),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    await db.transaction('rw', [db.syncOutbox, db.categoryTags], async () => {
      for (let index = 0; index < 101; index += 1) {
        const timestamp = new Date(
          Date.UTC(2026, 7, 20, 10, 0, 0, index),
        ).toISOString();
        const categoryTag = {
          id: `bounded-tag-${index.toString().padStart(3, '0')}`,
          scopeId: scope.id,
          name: `TAG ${index}`,
          colorHex: '#2563eb',
          position: `rank-${index.toString().padStart(3, '0')}`,
          surface: 'checklist_item' as const,
          useOwnName: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending' as const,
          remoteRevision: null,
          clientUpdatedAt: timestamp,
        };
        await db.categoryTags.add(categoryTag);
        await persistAccountEntityChange({
          baseRevision: null,
          changedFields: ['created'],
          entityId: categoryTag.id,
          entityType: 'categoryTag',
          operation: 'upsert',
          payload: categoryTag,
          scope,
        });
      }
    });
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map((call) => call[1].p_mutations.length)).toEqual([
      100, 1,
    ]);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
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
  it('overwrites a divergent remote revision when the user forces a sync', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('force-push-user');
    const failingRpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'stale_revision' },
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc: failingRpc });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-24',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Only on this device',
    });
    await waitForAccountPersistence(scope.id);

    await expect(db.syncOutbox.count()).resolves.toBeGreaterThan(0);
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'failed',
    });

    const sync = createSyncClient({
      remoteRevisions: { [entry.id]: 7, [item.id]: 4 },
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    expect(sync.rpc).toHaveBeenCalled();
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      remoteRevision: 5,
      syncStatus: 'synced',
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      remoteRevision: 8,
      syncStatus: 'synced',
    });
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'saved',
    });
  });

  it('sends a parent before its child when syncing', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('sync-order-user');
    const failingRpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'stale_revision' },
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc: failingRpc });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-24',
      timezone: 'America/Sao_Paulo',
    });
    const parent = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Parent',
    });
    const child = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      parentId: parent.id,
      text: 'Child',
    });
    await waitForAccountPersistence(scope.id);

    const sync = createSyncClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    expect(sync.pushedIds.indexOf(entry.id)).toBeLessThan(
      sync.pushedIds.indexOf(parent.id),
    );
    expect(sync.pushedIds.indexOf(parent.id)).toBeLessThan(
      sync.pushedIds.indexOf(child.id),
    );
  });

  it('recovers an entity stranded in the syncing state', async () => {
    const scope = createUserScope('stranded-syncing-user');
    const accountClient = createAccountWriteClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      accountClient.client,
    );
    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'STRANDED',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);
    accountClient.writes.length = 0;

    await db.categoryTags.update(categoryTag.id, { syncStatus: 'syncing' });
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'syncing',
    });

    await resumeAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    expect(accountClient.writes).toHaveLength(1);
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'saved',
    });
  });

  it('stops retrying an account operation automatically after five attempts', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('exhausted-attempts-user');
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'stale_revision' },
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'EXHAUSTED',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await retryFailedAccountPersistence(scope);
      await waitForAccountPersistence(scope.id);
    }

    expect(rpc).toHaveBeenCalledTimes(5);
    const operation = (await db.syncOutbox.toArray()).at(0);
    expect(operation?.attempts).toBe(5);
  });
  it('waits for the backoff window before retrying a failed account operation', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    try {
      const scope = createUserScope('backoff-account-user');
      let allowSuccess = false;
      const rpc = vi.fn(
        async (
          _functionName: string,
          args: {
            p_mutations: Array<{
              entity_type: string;
              payload: { id: string };
            }>;
            p_operation_id: string;
          },
        ) =>
          allowSuccess
            ? {
                data: {
                  operationId: args.p_operation_id,
                  mutations: args.p_mutations.map((mutation) => ({
                    entityType: mutation.entity_type,
                    id: mutation.payload.id,
                    revision: 3,
                  })),
                },
                error: null,
              }
            : {
                data: null,
                error: { code: 'network_error', message: 'response lost' },
              },
      );
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

      const categoryTag = await createCategoryTag({
        scope,
        surface: 'calendar',
        name: 'BACKOFF',
        colorHex: '#2563eb',
      });
      await waitForAccountPersistence(scope.id);

      expect(rpc).toHaveBeenCalledOnce();
      const failedOperation = await db.syncOutbox.toCollection().first();
      expect(failedOperation?.status).toBe('failed');
      expect(failedOperation?.nextAttemptAt).toBe(
        new Date(Date.now() + 1000).toISOString(),
      );

      allowSuccess = true;
      await vi.advanceTimersByTimeAsync(500);
      await waitForAccountPersistence(scope.id);

      expect(rpc).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(600);
      await waitForAccountPersistence(scope.id);

      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[1][1].p_operation_id).toBe(failedOperation!.id);
      await expect(db.syncOutbox.count()).resolves.toBe(0);
      await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
        remoteRevision: 3,
        syncStatus: 'synced',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops enqueuing account operations when the durable queue is full', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('bounded-queue-user');
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'network_error', message: 'offline' },
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    await db.syncOutbox.bulkPut(
      Array.from({ length: MAX_ACCOUNT_OUTBOX_OPERATIONS }, (_, index) => ({
        id: `seeded-operation-${index.toString().padStart(4, '0')}`,
        scopeId: scope.id,
        mutations: [],
        createdAt: '2026-08-25T10:00:00.000Z',
        attempts: 5,
        lastAttemptAt: '2026-08-25T10:00:00.000Z',
        lastError: 'network_error',
        nextAttemptAt: null,
        rebasedAt: null,
        status: 'failed' as const,
      })),
    );

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'OVERFLOW',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    await expect(db.syncOutbox.count()).resolves.toBe(
      MAX_ACCOUNT_OUTBOX_OPERATIONS,
    );
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      name: 'OVERFLOW',
      syncStatus: 'failed',
    });
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'failed',
    });
  });

  it('rebases a stale account operation once and reapplies it automatically', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('stale-rebase-user');
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            base_revision: number | null;
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) =>
        args.p_mutations.every((mutation) => mutation.base_revision === 12)
          ? {
              data: {
                operationId: args.p_operation_id,
                mutations: args.p_mutations.map((mutation) => ({
                  entityType: mutation.entity_type,
                  id: mutation.payload.id,
                  revision: 13,
                })),
              },
              error: null,
            }
          : {
              data: null,
              error: { code: '40001', message: 'stale_revision' },
            },
    );
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async (_column: string, ids: string[]) => ({
            data: ids.map((id) => ({ id, revision: 12 })),
            error: null,
          })),
        })),
      })),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from, rpc });

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'STALE',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_mutations[0].base_revision).toBeNull();
    expect(rpc.mock.calls[1][1].p_mutations[0].base_revision).toBe(12);
    expect(rpc.mock.calls[1][1].p_operation_id).toBe(
      rpc.mock.calls[0][1].p_operation_id,
    );
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      remoteRevision: 13,
      syncStatus: 'synced',
    });
  });

  it('keeps a repeatedly stale operation recoverable without rebasing twice', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('stale-blocked-user');
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'stale_revision' },
    }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async (_column: string, ids: string[]) => ({
            data: ids.map((id) => ({ id, revision: 20 })),
            error: null,
          })),
        })),
      })),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from, rpc });

    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'BLOCKED',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledTimes(2);
    const operation = await db.syncOutbox.toCollection().first();
    expect(operation).toMatchObject({
      lastError: '40001',
      status: 'failed',
    });
    expect(operation?.rebasedAt).not.toBeNull();

    await retryFailedAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    expect(rpc).toHaveBeenCalledTimes(3);
    await expect(db.syncOutbox.count()).resolves.toBe(1);
  });

  it('reports sync metrics without exposing user content', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('metrics-account-user');
    let allowSuccess = false;
    const rpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{
            entity_type: string;
            payload: { id: string };
          }>;
          p_operation_id: string;
        },
      ) =>
        allowSuccess
          ? {
              data: {
                operationId: args.p_operation_id,
                mutations: args.p_mutations.map((mutation) => ({
                  entityType: mutation.entity_type,
                  id: mutation.payload.id,
                  revision: 2,
                })),
              },
              error: null,
            }
          : {
              data: null,
              error: { code: 'network_error', message: 'offline' },
            },
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'PRIVATE CONTENT',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    const failedMetrics = await getAccountSyncMetrics(scope.id);

    expect(failedMetrics).toMatchObject({
      batchesRejected: 1,
      batchesSent: 1,
      definitiveFailures: 0,
      lastBatchDurationMs: expect.any(Number),
      lastBatchMutationCount: 1,
      lastBatchResult: 'rejected',
      lastErrorCode: 'network_error',
      maxBatchDurationMs: expect.any(Number),
      maxBatchMutationCount: 1,
      queuedOperations: 1,
      queuedMutations: 1,
    });
    expect(failedMetrics.oldestOperationAgeMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(failedMetrics)).not.toContain('PRIVATE CONTENT');

    allowSuccess = true;
    await retryFailedAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    await expect(getAccountSyncMetrics(scope.id)).resolves.toMatchObject({
      batchesConfirmed: 1,
      batchesRejected: 1,
      batchesSent: 2,
      lastBatchDurationMs: expect.any(Number),
      lastBatchMutationCount: 1,
      lastBatchResult: 'confirmed',
      queuedMutations: 0,
      queuedOperations: 0,
    });
  });
  it('keeps a repeated account refresh free of local writes when nothing changed', async () => {
    const scope = createUserScope('quiet-refresh-user');
    const rowsByTable = createRemoteEntityRows(scope, 3) as Record<
      string,
      unknown[]
    >;
    rowsByTable.user_preferences = [
      {
        user_id: scope.ownerId,
        key: 'taskTreeRowActions',
        value: { add: 'menu', priority: 'inline' },
      },
    ];
    const readClient = createPagedAccountReadClient({ rowsByTable });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(readClient.client);

    await refreshAccountCache(scope);

    const writeSpies = [
      vi.spyOn(db.categoryTags, 'put'),
      vi.spyOn(db.categoryTags, 'delete'),
      vi.spyOn(db.dailyEntries, 'put'),
      vi.spyOn(db.dailyEntries, 'delete'),
      vi.spyOn(db.checklistItems, 'put'),
      vi.spyOn(db.checklistItems, 'delete'),
      vi.spyOn(db.goalGroups, 'put'),
      vi.spyOn(db.goalGroups, 'delete'),
      vi.spyOn(db.goals, 'put'),
      vi.spyOn(db.goals, 'delete'),
      vi.spyOn(db.goalSteps, 'put'),
      vi.spyOn(db.goalSteps, 'delete'),
      vi.spyOn(db.localPreferences, 'put'),
      vi.spyOn(db.localPreferences, 'delete'),
    ];

    try {
      await refreshAccountCache(scope);

      for (const spy of writeSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      for (const spy of writeSpies) {
        spy.mockRestore();
      }
    }

    await expect(db.categoryTags.count()).resolves.toBe(3);
    await expect(
      getLocalPreference('taskTreeRowActions', scope),
    ).resolves.toEqual({
      add: 'menu',
      priority: 'inline',
    });
  });

  it('still applies a remote change after a quiet refresh', async () => {
    const scope = createUserScope('changed-refresh-user');
    const rowsByTable = createRemoteEntityRows(scope, 1) as Record<
      string,
      unknown[]
    >;
    rowsByTable.user_preferences = [];
    const readClient = createPagedAccountReadClient({ rowsByTable });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(readClient.client);

    await refreshAccountCache(scope);
    await expect(db.categoryTags.get('remote-tag-0000')).resolves.toMatchObject(
      {
        name: 'TAG 0',
      },
    );

    rowsByTable.category_tags = [
      {
        ...(rowsByTable.category_tags[0] as Record<string, unknown>),
        name: 'TAG RENAMED',
        revision: 9,
      },
    ];
    rowsByTable.user_preferences = [
      {
        user_id: scope.ownerId,
        key: 'checklistViewMode',
        value: 'tabs',
      },
    ];

    await refreshAccountCache(scope);

    await expect(db.categoryTags.get('remote-tag-0000')).resolves.toMatchObject(
      {
        name: 'TAG RENAMED',
        remoteRevision: 9,
      },
    );
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
  });
  it('pulls remote entities without sending them back', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('sync-pull-user');
    const remoteTag = {
      ...createRemoteBaseRow(scope, 'remote-tag', 0),
      name: 'REMOTE TAG',
      color_hex: '#2563eb',
      position: 'position-0',
      surface: 'checklist_item',
      use_own_name: false,
    };
    const sync = createSyncClient({ snapshot: { category_tags: [remoteTag] } });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    await expect(db.categoryTags.get(remoteTag.id)).resolves.toMatchObject({
      name: 'REMOTE TAG',
      syncStatus: 'synced',
    });
    expect(sync.rpc).not.toHaveBeenCalled();
  });

  it('keeps the local version when the same entity diverged remotely', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('sync-tiebreak-user');
    const failingRpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'stale_revision' },
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc: failingRpc });

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'LOCAL WINS',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    const divergentRemoteTag = {
      ...createRemoteBaseRow(scope, 'ignored', 0),
      id: categoryTag.id,
      name: 'REMOTE LOSES',
      color_hex: '#111111',
      position: 'position-9',
      surface: 'checklist_item',
      use_own_name: false,
      revision: 12,
    };
    const sync = createSyncClient({
      remoteRevisions: { [categoryTag.id]: 12 },
      snapshot: { category_tags: [divergentRemoteTag] },
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    expect(sync.pushedIds).toContain(categoryTag.id);
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      name: 'LOCAL WINS',
      remoteRevision: 13,
      syncStatus: 'synced',
    });
  });

  it('sends nothing on a second sync once the device converged', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('sync-convergence-user');
    const failingRpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'stale_revision' },
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc: failingRpc });

    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'CONVERGES',
      colorHex: '#2563eb',
    });
    await waitForAccountPersistence(scope.id);

    const remoteTag = {
      ...createRemoteBaseRow(scope, 'remote-tag', 0),
      name: 'REMOTE TAG',
      color_hex: '#2563eb',
      position: 'position-0',
      surface: 'checklist_item',
      use_own_name: false,
    };
    const sync = createSyncClient({ snapshot: { category_tags: [remoteTag] } });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    expect(sync.pushedIds).toEqual([categoryTag.id]);

    sync.rpc.mockClear();

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    expect(sync.rpc).not.toHaveBeenCalled();
  });
  it('resends an ancestor that disappeared from the remote', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    const scope = createUserScope('sync-ancestor-user');
    const seedRpc = vi.fn(
      async (
        _functionName: string,
        args: {
          p_mutations: Array<{ entity_type: string; payload: { id: string } }>;
          p_operation_id: string;
        },
      ) => ({
        data: {
          operationId: args.p_operation_id,
          mutations: args.p_mutations.map((mutation) => ({
            entityType: mutation.entity_type,
            id: mutation.payload.id,
            revision: 1,
          })),
        },
        error: null,
      }),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc: seedRpc });

    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-08-24',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Orphan candidate',
    });
    await waitForAccountPersistence(scope.id);

    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      syncStatus: 'synced',
    });

    await db.checklistItems.update(item.id, { syncStatus: 'pending' });

    const sync = createSyncClient({ remoteRevisions: { [item.id]: 1 } });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(sync.client);

    await forceSyncAccount(scope);
    await waitForAccountPersistence(scope.id);

    await expect(db.dailyEntries.get(entry.id)).resolves.toBeDefined();
    expect(sync.pushedIds).toContain(entry.id);
    expect(sync.pushedIds.indexOf(entry.id)).toBeLessThan(
      sync.pushedIds.indexOf(item.id),
    );
  });
});
