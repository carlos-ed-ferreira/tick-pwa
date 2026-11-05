import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserScope, type Goal } from '@/lib/domain';
import { createGoal, db, softDeleteGoal, updateGoalTitle } from '@/lib/db';
import {
  forceSyncAccount,
  waitForAccountPersistence,
} from '@/lib/db/account-persistence';
import { refreshAccountCache } from '@/lib/supabase/account-cache';
import { toRemotePayload } from '@/lib/supabase/entity-mappers';

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: mocks.client,
}));
vi.mock('@/lib/environment', () => ({
  shouldUseAccountOperationBatchesForUser: () => true,
}));

function delayedClient(goals: unknown[] = [], initialRevision = 0) {
  let release!: () => void;
  let started!: () => void;
  let revision = initialRevision;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      if (columns === 'id,revision')
        return {
          eq: () => ({
            in: async (_column: string, ids: string[]) => ({
              data: ids.map((id) => ({ id, revision })),
              error: null,
            }),
          }),
        };
      if (table === 'user_preferences')
        return Promise.resolve({ data: [], error: null });
      const query = {
        order: vi.fn(() => query),
        range: vi.fn(async () => {
          if (table === 'goal_steps') {
            started();
            await barrier;
          }
          return { data: table === 'goals' ? goals : [], error: null };
        }),
      };
      return query;
    }),
  }));
  const rpc = vi.fn(
    async (
      _name: string,
      args: {
        p_operation_id: string;
        p_mutations: Array<{ entity_type: string; payload: { id: string } }>;
      },
    ) => {
      revision += 1;
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
    },
  );
  return { client: { from, rpc }, requested, release };
}

describe('account snapshot concurrency', () => {
  const scope = createUserScope('snapshot-race-user');
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    mocks.client.mockReset();
    await db.delete();
  });

  it('preserves a creation acknowledged after the snapshot started', async () => {
    const remote = delayedClient();
    mocks.client.mockReturnValue(remote.client);
    const refresh = refreshAccountCache(scope);
    await remote.requested;
    const goal = await createGoal({ scope, title: 'New goal' });
    await waitForAccountPersistence(scope.id);
    remote.release();
    await refresh;
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      title: 'NEW GOAL',
      syncStatus: 'synced',
    });
  });

  it.each(['rename', 'delete'])(
    'preserves a confirmed %s while a previous snapshot is in flight',
    async (action) => {
      mocks.client.mockReturnValue(delayedClient().client);
      const created = await createGoal({ scope, title: 'Original' });
      await waitForAccountPersistence(scope.id);
      const goal = (await db.goals.get(created.id)) as Goal;
      const remote = delayedClient(
        [
          {
            ...toRemotePayload(
              scope,
              'goal',
              goal as unknown as Record<string, unknown>,
            ),
            revision: 1,
          },
        ],
        1,
      );
      mocks.client.mockReturnValue(remote.client);
      const refresh = refreshAccountCache(scope);
      await remote.requested;
      if (action === 'rename')
        await updateGoalTitle({ scope, goalId: goal.id, title: 'New title' });
      else await softDeleteGoal({ scope, goalId: goal.id });
      await waitForAccountPersistence(scope.id);
      const confirmed = await db.goals.get(goal.id);
      remote.release();
      await refresh;
      await expect(db.goals.get(goal.id)).resolves.toEqual(confirmed);
    },
  );

  it('rejects an older revision even without an in-flight local write', async () => {
    mocks.client.mockReturnValue(delayedClient([], 2).client);
    const created = await createGoal({ scope, title: 'Current' });
    await waitForAccountPersistence(scope.id);
    const goal = (await db.goals.get(created.id)) as Goal;
    const remote = delayedClient([
      {
        ...toRemotePayload(
          scope,
          'goal',
          goal as unknown as Record<string, unknown>,
        ),
        title: 'STALE',
        revision: 1,
      },
    ]);
    mocks.client.mockReturnValue(remote.client);
    const refresh = refreshAccountCache(scope);
    await remote.requested;
    remote.release();
    await refresh;
    await expect(db.goals.get(goal.id)).resolves.toEqual(goal);
  });

  it('still reconciles a remote deletion of an unchanged synchronized entity', async () => {
    mocks.client.mockReturnValue(delayedClient().client);
    const goal = await createGoal({ scope, title: 'Deleted remotely' });
    await waitForAccountPersistence(scope.id);
    const remote = delayedClient();
    mocks.client.mockReturnValue(remote.client);
    const refresh = refreshAccountCache(scope);
    await remote.requested;
    remote.release();
    await refresh;
    await expect(db.goals.get(goal.id)).resolves.toBeUndefined();
  });
  it('serializes a forced push behind an in-flight automatic RPC', async () => {
    const remoteRows: unknown[] = [];
    const remote = delayedClient(remoteRows);
    remote.release();
    let releaseWrite!: () => void;
    let active = 0;
    let maximum = 0;
    const original = remote.client.rpc.getMockImplementation()!;
    const barrier = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    remote.client.rpc.mockImplementation(async (...args) => {
      active += 1;
      maximum = Math.max(maximum, active);
      const result = await original(...args);
      if (remote.client.rpc.mock.calls.length === 1) await barrier;
      active -= 1;
      return result;
    });
    mocks.client.mockReturnValue(remote.client);
    const created = await createGoal({ scope, title: 'Concurrent sync' });
    await vi.waitFor(() => expect(remote.client.rpc).toHaveBeenCalledTimes(1));
    const forced = forceSyncAccount(scope);
    const completion = forced.then(
      () => 'completed',
      () => 'failed',
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    remoteRows.push({
      ...toRemotePayload(
        scope,
        'goal',
        (await db.goals.get(created.id)) as unknown as Record<string, unknown>,
      ),
      revision: 1,
    });
    releaseWrite();
    await completion;
    await waitForAccountPersistence(scope.id);
    expect(maximum).toBe(1);
    await expect(db.goals.get(created.id)).resolves.toMatchObject({
      title: 'CONCURRENT SYNC',
      syncStatus: 'synced',
    });
  });
});
