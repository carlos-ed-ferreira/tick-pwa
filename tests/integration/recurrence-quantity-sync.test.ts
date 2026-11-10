import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUserScope,
  type RecurrenceContent,
  type RecurrenceRule,
} from '@/lib/domain';
import { createRecurrence, db, setRecurrenceQuantity } from '@/lib/db';
import {
  resumeAccountPersistence,
  waitForAccountPersistence,
} from '@/lib/db/account-persistence';
import { refreshAccountCache } from '@/lib/supabase/account-cache';

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

const today = '2026-11-10' as const;
const rule: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};
const pages = { target: 20, unit: 'páginas' };
const reading: RecurrenceContent = {
  text: 'Ler',
  bold: false,
  priority: false,
  categoryTagId: null,
  children: [],
  measure: pages,
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

function answerMutations(rpc: ReturnType<typeof vi.fn>) {
  return rpc.mock.calls.flatMap((call) =>
    (call[1] as RpcArguments).p_mutations.filter(
      (mutation) => mutation.entity_type === 'recurrenceResponse',
    ),
  );
}

function record(
  scope: ReturnType<typeof createUserScope>,
  recurrenceId: string,
  value: number | null,
) {
  return setRecurrenceQuantity({
    date: today,
    itemId: null,
    recurrenceId,
    scope,
    today,
    value,
  });
}

function remoteResponse(
  scope: ReturnType<typeof createUserScope>,
  recurrenceId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `rr:${scope.id}:${recurrenceId}:${today}:root`,
    user_id: scope.ownerId,
    created_at: '2026-11-10T08:00:00.000Z',
    updated_at: '2026-11-10T09:00:00.000Z',
    deleted_at: null,
    client_updated_at: '2026-11-10T09:00:00.000Z',
    revision: 7,
    recurrence_id: recurrenceId,
    date: today,
    item_id: null,
    status: 'not_done',
    ...overrides,
  };
}

function pagedRead(rowsByTable: Record<string, unknown[]>) {
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

describe('quantitative recurrence synchronization', () => {
  beforeEach(async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      true,
    );
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('sends the measure and the quantity snapshot online', async () => {
    const scope = createUserScope('quantity-online');
    const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
      acceptOperation(args),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    const recurrence = await createRecurrence({
      scope,
      content: reading,
      rule,
    });
    await record(scope, recurrence.id, 12.5);
    await waitForAccountPersistence(scope.id);

    const definition = rpc.mock.calls[0][1].p_mutations[0];

    expect(definition.payload).toMatchObject({ measure: pages });
    expect(answerMutations(rpc).map((mutation) => mutation.payload)).toEqual([
      expect.objectContaining({
        quantity: 12.5,
        status: 'not_done',
        target: 20,
        unit: 'páginas',
      }),
    ]);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
  });

  it('keeps offline edits durable and delivers the latest total', async () => {
    const scope = createUserScope('quantity-offline');
    const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
      acceptOperation(args),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });
    const online = vi
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(false);

    const recurrence = await createRecurrence({
      scope,
      content: reading,
      rule,
    });
    await record(scope, recurrence.id, 5);
    await record(scope, recurrence.id, 12);
    await record(scope, recurrence.id, 25);
    await waitForAccountPersistence(scope.id);

    expect(rpc).not.toHaveBeenCalled();
    await expect(db.recurrenceResponses.count()).resolves.toBe(1);
    await expect(
      db.recurrenceResponses.toCollection().first(),
    ).resolves.toMatchObject({
      quantity: { ...pages, value: 25 },
      status: 'done',
      syncStatus: 'pending',
    });

    online.mockReturnValue(true);
    await resumeAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);

    const answers = answerMutations(rpc);

    expect(answers.at(-1)?.payload).toMatchObject({
      quantity: 25,
      status: 'done',
    });
    expect(
      answers.every(
        (mutation) => typeof mutation.payload.quantity === 'number',
      ),
    ).toBe(true);
    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(
      db.recurrenceResponses.toCollection().first(),
    ).resolves.toMatchObject({
      quantity: { ...pages, value: 25 },
      syncStatus: 'synced',
    });
  });

  it('rebases a conflicting answer without adding the values', async () => {
    const scope = createUserScope('quantity-conflict');
    const rpc = vi.fn(async (_name: string, args: RpcArguments) => {
      const isFirstAnswer = args.p_mutations.some(
        (mutation) =>
          mutation.entity_type === 'recurrenceResponse' &&
          mutation.base_revision === null,
      );

      return isFirstAnswer
        ? { data: null, error: { code: 'PT409', message: 'stale_revision' } }
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

    const recurrence = await createRecurrence({
      scope,
      content: reading,
      rule,
    });
    await waitForAccountPersistence(scope.id);
    await record(scope, recurrence.id, 15);
    await waitForAccountPersistence(scope.id);

    const answers = answerMutations(rpc);

    expect(answers).toHaveLength(2);
    expect(answers[1].base_revision).toBe(8);
    expect(answers[1].payload).toMatchObject({ quantity: 15 });
    await expect(db.recurrenceResponses.count()).resolves.toBe(1);
    await expect(
      db.recurrenceResponses.toCollection().first(),
    ).resolves.toMatchObject({
      quantity: { ...pages, value: 15 },
      remoteRevision: 9,
    });
  });

  it('sends zero as a value and clearing as a deletion', async () => {
    const scope = createUserScope('quantity-zero');
    const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
      acceptOperation(args),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    const recurrence = await createRecurrence({
      scope,
      content: reading,
      rule,
    });
    await record(scope, recurrence.id, 0);
    await waitForAccountPersistence(scope.id);
    await record(scope, recurrence.id, null);
    await waitForAccountPersistence(scope.id);

    const [zero, cleared] = answerMutations(rpc).map(
      (mutation) => mutation.payload,
    );

    expect(zero).toMatchObject({ quantity: 0, deleted_at: null });
    expect(cleared.deleted_at).toEqual(expect.any(String));
    expect(cleared).toMatchObject({ quantity: 0, target: 20 });
  });

  it('writes the quantity columns through the legacy upsert', async () => {
    environmentMocks.shouldUseAccountOperationBatchesForUser.mockReturnValue(
      false,
    );
    const scope = createUserScope('quantity-legacy');
    const payloads: Array<{ table: string; payload: Record<string, unknown> }> =
      [];
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        upsert: vi.fn((payload: Record<string, unknown>) => {
          payloads.push({ table, payload });

          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { revision: payloads.length },
                error: null,
              }),
            })),
          };
        }),
      })),
    });

    const recurrence = await createRecurrence({
      scope,
      content: reading,
      rule,
    });
    await record(scope, recurrence.id, 7);
    await waitForAccountPersistence(scope.id);

    expect(payloads[0]).toMatchObject({
      table: 'recurrences',
      payload: { measure: pages },
    });
    expect(payloads[1]).toMatchObject({
      table: 'recurrence_responses',
      payload: { quantity: 7, target: 20, unit: 'páginas' },
    });
  });

  it('takes the absolute value another device recorded', async () => {
    const scope = createUserScope('quantity-pull');
    const rpc = vi.fn(async (_name: string, args: RpcArguments) =>
      acceptOperation(args),
    );
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ rpc });

    const recurrence = await createRecurrence({
      scope,
      content: reading,
      rule,
    });
    await record(scope, recurrence.id, 10);
    await waitForAccountPersistence(scope.id);

    const remoteDefinition = {
      id: recurrence.id,
      user_id: scope.ownerId,
      created_at: recurrence.createdAt,
      updated_at: recurrence.updatedAt,
      deleted_at: null,
      client_updated_at: recurrence.clientUpdatedAt,
      revision: 3,
      category_tag_id: null,
      text: 'Ler',
      bold: false,
      priority: false,
      children: [],
      schedule: recurrence.schedule,
      content_history: [],
      measure: pages,
    };

    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: pagedRead({
        recurrences: [remoteDefinition],
        recurrence_responses: [
          remoteResponse(scope, recurrence.id, {
            quantity: '15.000',
            target: '20.000',
            unit: 'páginas',
          }),
        ],
      }),
    });

    await refreshAccountCache(scope);

    await expect(
      db.recurrenceResponses.toCollection().first(),
    ).resolves.toMatchObject({ quantity: { ...pages, value: 15 } });
  });

  it('keeps an old binary answer from another device without inventing a value', async () => {
    const scope = createUserScope('quantity-binary-pull');
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: pagedRead({
        recurrence_responses: [
          remoteResponse(scope, 'reading', { status: 'done' }),
        ],
      }),
    });

    await refreshAccountCache(scope);

    const stored = await db.recurrenceResponses.toCollection().first();

    expect(stored).toMatchObject({ status: 'done', quantity: null });
  });
});
