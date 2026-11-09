import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUserScope,
  type RecurrenceContent,
  type RecurrenceRule,
} from '@/lib/domain';
import {
  createCategoryTag,
  createRecurrence,
  db,
  setRecurrenceResponse,
  softDeleteRecurrence,
} from '@/lib/db';
import {
  accountEntityTypes,
  getAccountEntityTable,
} from '@/lib/db/account-entity-tables';
import {
  forceSyncAccount,
  resumeAccountPersistence,
  waitForAccountPersistence,
} from '@/lib/db/account-persistence';
import { refreshAccountCache } from '@/lib/supabase/account-cache';
import { restoreAccountEntity } from '@/lib/supabase/account-data';
import {
  getRemoteTableName,
  recurrenceFromRemote,
  recurrenceResponseFromRemote,
  toRemotePayload,
  type RemoteRecurrence,
  type RemoteRecurrenceResponse,
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

const today = '2026-11-06' as const;

const rule: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};

const content: RecurrenceContent = {
  text: 'Stretch',
  bold: true,
  priority: true,
  categoryTagId: null,
  children: [
    {
      id: 'child-1',
      parentId: null,
      text: 'Child',
      bold: false,
      priority: true,
      sortRank: 'a0',
    },
  ],
};

interface RpcMutation {
  base_revision: number | null;
  entity_type: string;
  payload: Record<string, unknown> & { id: string };
}

interface RpcArguments {
  p_mutations: RpcMutation[];
  p_operation_id: string;
}

function acceptOperation(args: RpcArguments, revision = 3) {
  return {
    data: {
      operationId: args.p_operation_id,
      mutations: args.p_mutations.map((mutation) => ({
        entityType: mutation.entity_type,
        id: mutation.payload.id,
        revision,
      })),
    },
    error: null,
  };
}

function enableBatches() {
  environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
    true,
  );
}

function createPagedRead(rowsByTable: Record<string, unknown[]>) {
  return vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      if (columns === 'key,value') {
        return Promise.resolve({ data: [], error: null });
      }

      const query = {
        order: vi.fn(() => query),
        range: vi.fn(() =>
          Promise.resolve({ data: rowsByTable[table] ?? [], error: null }),
        ),
      };

      return query;
    }),
  }));
}

function createRemoteRecurrence(
  scope: ReturnType<typeof createUserScope>,
  overrides: Partial<RemoteRecurrence> = {},
): RemoteRecurrence {
  return {
    id: 'remote-recurrence',
    user_id: scope.ownerId,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    client_updated_at: '2026-01-01T00:00:00.000Z',
    revision: 2,
    category_tag_id: null,
    text: 'Remote',
    bold: false,
    priority: false,
    children: [],
    schedule: [{ from: null, rule }],
    content_history: [],
    ...overrides,
  };
}

async function createLocalRecurrence(
  scope: ReturnType<typeof createUserScope>,
) {
  enableBatches();
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
  supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc: vi.fn() });

  return createRecurrence({ scope, content, rule });
}

describe('recurrence synchronization', () => {
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

  describe('entity coverage', () => {
    it('maps every entity type to its own local and remote table', () => {
      const localTables = accountEntityTypes.map(
        (entityType) => getAccountEntityTable(entityType).name,
      );
      const remoteTables = accountEntityTypes.map(getRemoteTableName);

      expect(new Set(localTables).size).toBe(accountEntityTypes.length);
      expect(new Set(remoteTables).size).toBe(accountEntityTypes.length);
      expect(remoteTables).toEqual(
        expect.arrayContaining(['recurrences', 'recurrence_responses']),
      );
    });

    it('sends the definition before its answers and after its category', () => {
      const position = (entityType: (typeof accountEntityTypes)[number]) =>
        accountEntityTypes.indexOf(entityType);

      expect(position('categoryTag')).toBeLessThan(position('recurrence'));
      expect(position('recurrence')).toBeLessThan(
        position('recurrenceResponse'),
      );
    });
  });

  describe('mappers', () => {
    const scope = createUserScope('mapper-user');

    it('round-trips a definition with its children and history', () => {
      const local = recurrenceFromRemote(scope, createRemoteRecurrence(scope));

      expect(local).toMatchObject({
        id: 'remote-recurrence',
        scopeId: scope.id,
        syncStatus: 'synced',
        remoteRevision: 2,
      });

      const history = [{ ...content, until: today }];
      const payload = toRemotePayload(scope, 'recurrence', {
        ...local,
        ...content,
        contentHistory: history,
      });

      expect(payload).toMatchObject({
        id: 'remote-recurrence',
        user_id: scope.ownerId,
        text: 'Stretch',
        bold: true,
        priority: true,
        children: content.children,
        schedule: [{ from: null, rule }],
        content_history: history,
      });
    });

    it('treats malformed remote JSON as an empty definition', () => {
      const local = recurrenceFromRemote(
        scope,
        createRemoteRecurrence(scope, {
          children: null,
          schedule: 'broken',
          content_history: {},
        } as unknown as Partial<RemoteRecurrence>),
      );

      expect(local.children).toEqual([]);
      expect(local.schedule).toEqual([]);
      expect(local.contentHistory).toEqual([]);
    });

    it('round-trips an answer of the activity and of a child', () => {
      const row: RemoteRecurrenceResponse = {
        id: 'remote-response',
        user_id: scope.ownerId,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
        client_updated_at: '2026-01-01T00:00:00.000Z',
        revision: 4,
        recurrence_id: 'remote-recurrence',
        date: today,
        item_id: 'child-1',
        status: 'not_done',
      };
      const local = recurrenceResponseFromRemote(scope, row);

      expect(local).toMatchObject({
        recurrenceId: 'remote-recurrence',
        date: today,
        itemId: 'child-1',
        status: 'not_done',
        remoteRevision: 4,
      });
      expect(
        toRemotePayload(scope, 'recurrenceResponse', { ...local }),
      ).toMatchObject({
        recurrence_id: 'remote-recurrence',
        date: today,
        item_id: 'child-1',
        status: 'not_done',
      });
    });
  });

  describe('durable batches', () => {
    it('confirms the category, the definition and the answer in order', async () => {
      enableBatches();
      const scope = createUserScope('batch-user');
      const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
        acceptOperation(args),
      );
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

      const category = await createCategoryTag({
        scope,
        surface: 'recurrence',
        name: 'Health',
        colorHex: '#2563eb',
      });
      const recurrence = await createRecurrence({
        scope,
        content: { ...content, categoryTagId: category.id },
        rule,
      });
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      await waitForAccountPersistence(scope.id);

      expect(
        rpc.mock.calls.flatMap((call) =>
          call[1].p_mutations.map((mutation) => mutation.entity_type),
        ),
      ).toEqual(['categoryTag', 'recurrence', 'recurrenceResponse']);
      await expect(db.syncOutbox.count()).resolves.toBe(0);
      await expect(db.recurrences.get(recurrence.id)).resolves.toMatchObject({
        syncStatus: 'synced',
        remoteRevision: 3,
      });
      await expect(
        db.recurrenceResponses.toCollection().first(),
      ).resolves.toMatchObject({ syncStatus: 'synced', remoteRevision: 3 });
    });

    it('rebases an answer another device already created for the date', async () => {
      enableBatches();
      const scope = createUserScope('conflict-user');
      const rpc = vi.fn(async (_name: string, args: RpcArguments) => {
        const isAnswer = args.p_mutations.some(
          (mutation) => mutation.entity_type === 'recurrenceResponse',
        );
        const isFirstAttempt = args.p_mutations.some(
          (mutation) => mutation.base_revision === null,
        );

        return isAnswer && isFirstAttempt
          ? {
              data: null,
              error: { code: 'PT409', message: 'stale_revision' },
            }
          : acceptOperation(args, 9);
      });
      const from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async (_column: string, ids: string[]) => ({
              data: ids.map((id) => ({ id, revision: 8 })),
              error: null,
            })),
          })),
        })),
      }));
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from, rpc });

      const recurrence = await createRecurrence({ scope, content, rule });
      await waitForAccountPersistence(scope.id);
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'not_done',
        today,
      });
      await waitForAccountPersistence(scope.id);

      const answerCalls = rpc.mock.calls.filter((call) =>
        call[1].p_mutations.some(
          (mutation) => mutation.entity_type === 'recurrenceResponse',
        ),
      );

      expect(answerCalls).toHaveLength(2);
      expect(answerCalls[1][1].p_operation_id).toBe(
        answerCalls[0][1].p_operation_id,
      );
      expect(answerCalls[1][1].p_mutations[0].base_revision).toBe(8);
      await expect(db.syncOutbox.count()).resolves.toBe(0);
      await expect(
        db.recurrenceResponses.toCollection().first(),
      ).resolves.toMatchObject({
        status: 'not_done',
        syncStatus: 'synced',
        remoteRevision: 9,
      });
    });

    it('keeps answers durable offline and delivers them on reconnect', async () => {
      enableBatches();
      const scope = createUserScope('offline-user');
      const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
        acceptOperation(args),
      );
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });
      const online = vi
        .spyOn(window.navigator, 'onLine', 'get')
        .mockReturnValue(false);

      const recurrence = await createRecurrence({ scope, content, rule });
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: 'child-1',
        status: 'done',
        today,
      });
      await waitForAccountPersistence(scope.id);

      expect(rpc).not.toHaveBeenCalled();
      await expect(
        db.recurrenceResponses.toCollection().first(),
      ).resolves.toMatchObject({ syncStatus: 'pending', itemId: 'child-1' });

      online.mockReturnValue(true);
      await resumeAccountPersistence(scope);
      await waitForAccountPersistence(scope.id);

      await expect(db.syncOutbox.count()).resolves.toBe(0);
      await expect(
        db.recurrenceResponses.toCollection().first(),
      ).resolves.toMatchObject({ syncStatus: 'synced' });
    });

    it('sends the removal of the definition and of each answer', async () => {
      enableBatches();
      const scope = createUserScope('delete-user');
      const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
        acceptOperation(args),
      );
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

      const recurrence = await createRecurrence({ scope, content, rule });
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      await waitForAccountPersistence(scope.id);
      rpc.mockClear();

      await softDeleteRecurrence({ scope, recurrenceId: recurrence.id });
      await waitForAccountPersistence(scope.id);

      const mutations = rpc.mock.calls.flatMap((call) => call[1].p_mutations);

      expect(mutations.map((mutation) => mutation.entity_type)).toEqual([
        'recurrence',
        'recurrenceResponse',
      ]);
      expect(
        mutations.every((mutation) => mutation.payload.deleted_at !== null),
      ).toBe(true);
    });

    it('force sync pushes a pending definition and its answer', async () => {
      enableBatches();
      const scope = createUserScope('force-sync-user');
      const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
        acceptOperation(args),
      );
      const online = vi
        .spyOn(window.navigator, 'onLine', 'get')
        .mockReturnValue(false);
      const read = createPagedRead({});
      const from = vi.fn((table: string) => {
        const query = read(table);
        const select = query.select;

        return {
          select: vi.fn((columns: string) =>
            columns === 'id,revision'
              ? {
                  eq: vi.fn(() => ({
                    in: vi.fn(async () => ({ data: [], error: null })),
                  })),
                  in: vi.fn(async () => ({ data: [], error: null })),
                }
              : select(columns),
          ),
        };
      });
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc, from });

      const recurrence = await createRecurrence({ scope, content, rule });
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      online.mockReturnValue(true);

      await forceSyncAccount(scope);

      const mutations = rpc.mock.calls.flatMap((call) => call[1].p_mutations);

      expect(
        mutations.map((mutation) => [
          mutation.entity_type,
          mutation.base_revision,
        ]),
      ).toEqual([
        ['recurrence', null],
        ['recurrenceResponse', null],
      ]);
    });
  });

  describe('legacy path', () => {
    it('upserts the answer by id so a repeated answer converges', async () => {
      const scope = createUserScope('legacy-user');
      const writes: Array<{ table: string; options: unknown }> = [];
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
        from: vi.fn((table: string) => ({
          upsert: vi.fn((_payload: unknown, options: unknown) => {
            writes.push({ table, options });

            return {
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { revision: writes.length },
                  error: null,
                }),
              })),
            };
          }),
        })),
      });

      const recurrence = await createRecurrence({ scope, content, rule });
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      await waitForAccountPersistence(scope.id);

      expect(writes.map((write) => write.table)).toEqual([
        'recurrences',
        'recurrence_responses',
      ]);
      expect(writes[1].options).toEqual({ onConflict: 'id' });
    });
  });

  describe('legacy restore', () => {
    function mockRemoteRow(data: unknown) {
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
            })),
          })),
        })),
      });
    }

    it('replaces a rejected definition with the canonical remote row', async () => {
      const scope = createUserScope('restore-user');
      const recurrence = await createLocalRecurrence(scope);

      mockRemoteRow(
        createRemoteRecurrence(scope, { id: recurrence.id, text: 'Canonical' }),
      );
      await restoreAccountEntity({
        entityId: recurrence.id,
        entityType: 'recurrence',
        scope,
      });

      await expect(db.recurrences.get(recurrence.id)).resolves.toMatchObject({
        text: 'Canonical',
        syncStatus: 'synced',
      });
    });

    it('removes an answer the remote no longer has', async () => {
      const scope = createUserScope('restore-missing-user');
      const recurrence = await createLocalRecurrence(scope);

      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });

      const answer = await db.recurrenceResponses.toCollection().first();

      mockRemoteRow(null);
      await restoreAccountEntity({
        entityId: answer!.id,
        entityType: 'recurrenceResponse',
        scope,
      });

      await expect(db.recurrenceResponses.count()).resolves.toBe(0);
    });
  });

  describe('pull', () => {
    it('merges remote definitions and answers into the account cache', async () => {
      const scope = createUserScope('pull-user');
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
        from: createPagedRead({
          recurrences: [createRemoteRecurrence(scope)],
          recurrence_responses: [
            {
              id: 'remote-response',
              user_id: scope.ownerId,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
              deleted_at: null,
              client_updated_at: '2026-01-01T00:00:00.000Z',
              revision: 4,
              recurrence_id: 'remote-recurrence',
              date: today,
              item_id: null,
              status: 'done',
            },
          ],
        }),
      });

      const result = await refreshAccountCache(scope);

      expect(result?.tables.recurrences.rows).toBe(1);
      expect(result?.tables.recurrence_responses.rows).toBe(1);
      await expect(
        db.recurrences.get('remote-recurrence'),
      ).resolves.toMatchObject({ text: 'Remote', scopeId: scope.id });
      await expect(
        db.recurrenceResponses.get('remote-response'),
      ).resolves.toMatchObject({ status: 'done', scopeId: scope.id });
    });

    it('keeps a pending answer and its definition absent from the snapshot', async () => {
      const scope = createUserScope('pull-pending-user');
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      enableBatches();
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
        from: createPagedRead({}),
      });

      const recurrence = await createRecurrence({ scope, content, rule });
      await setRecurrenceResponse({
        scope,
        recurrenceId: recurrence.id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });

      await refreshAccountCache(scope);

      await expect(db.recurrences.get(recurrence.id)).resolves.toBeDefined();
      await expect(db.recurrenceResponses.count()).resolves.toBe(1);
    });

    it('tolerates a backend that does not have the new tables yet', async () => {
      const scope = createUserScope('rollout-user');
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn((columns: string) => {
            if (columns === 'key,value') {
              return Promise.resolve({ data: [], error: null });
            }

            const isNewTable = table.startsWith('recurrence');
            const query = {
              order: vi.fn(() => query),
              range: vi.fn(() =>
                Promise.resolve(
                  isNewTable
                    ? {
                        data: null,
                        error: {
                          code: 'PGRST205',
                          message: `Could not find the table 'public.${table}'`,
                        },
                      }
                    : { data: [], error: null },
                ),
              ),
            };

            return query;
          }),
        })),
      });

      await expect(refreshAccountCache(scope)).resolves.toMatchObject({
        totalRows: 0,
      });
    });
  });

  describe('isolation', () => {
    it('does not let one account answer the recurrence of another', async () => {
      const owner = createUserScope('owner-user');
      const intruder = createUserScope('intruder-user');
      enableBatches();
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
        rpc: vi.fn(),
      });

      const recurrence = await createRecurrence({
        scope: owner,
        content,
        rule,
      });

      await expect(
        setRecurrenceResponse({
          scope: intruder,
          recurrenceId: recurrence.id,
          date: today,
          itemId: null,
          status: 'done',
          today,
        }),
      ).resolves.toBe(false);
      await expect(db.recurrenceResponses.count()).resolves.toBe(0);
    });
  });
});
