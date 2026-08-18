import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAccountOperationBatch } from '@/lib/supabase/account-operations';
import { createGuestScope, createUserScope } from '@/lib/domain';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

describe('account operation batches', () => {
  beforeEach(() => {
    supabaseMocks.getSupabaseBrowserClient.mockReset();
  });

  it('never sends a guest batch to Supabase', async () => {
    await expect(
      applyAccountOperationBatch({
        mutations: [],
        operationId: '10000000-0000-0000-0000-000000000001',
        scope: createGuestScope('guest-installation'),
      }),
    ).resolves.toBeNull();

    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it('maps an authenticated calendar batch to one RPC without client ownership', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        operationId: '20000000-0000-0000-0000-000000000002',
        mutations: [
          { entityType: 'categoryTag', id: 'category-1', revision: 1 },
        ],
      },
      error: null,
    });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      rpc,
    } as unknown as SupabaseClient);

    await expect(
      applyAccountOperationBatch({
        mutations: [
          {
            baseRevision: null,
            entityType: 'categoryTag',
            payload: {
              id: 'category-1',
              scopeId: 'user:untrusted-user',
              name: 'Focus',
              colorHex: '#112233',
              position: 'a0',
              surface: 'calendar',
              useOwnName: false,
              createdAt: '2026-08-18T12:00:00.000Z',
              updatedAt: '2026-08-18T12:00:00.000Z',
              deletedAt: null,
              clientUpdatedAt: '2026-08-18T12:00:00.000Z',
            },
          },
        ],
        operationId: '20000000-0000-0000-0000-000000000002',
        scope: createUserScope('authenticated-user'),
      }),
    ).resolves.toEqual({
      operationId: '20000000-0000-0000-0000-000000000002',
      mutations: [{ entityType: 'categoryTag', id: 'category-1', revision: 1 }],
    });

    expect(rpc).toHaveBeenCalledWith('apply_account_operation_batch', {
      p_mutations: [
        {
          base_revision: null,
          entity_type: 'categoryTag',
          payload: {
            id: 'category-1',
            name: 'Focus',
            color_hex: '#112233',
            position: 'a0',
            surface: 'checklist_item',
            use_own_name: false,
            created_at: '2026-08-18T12:00:00.000Z',
            updated_at: '2026-08-18T12:00:00.000Z',
            deleted_at: null,
            client_updated_at: '2026-08-18T12:00:00.000Z',
          },
        },
      ],
      p_operation_id: '20000000-0000-0000-0000-000000000002',
    });
  });

  it('rejects unsupported entities and oversized batches before the network', async () => {
    const scope = createUserScope('authenticated-user');

    await expect(
      applyAccountOperationBatch({
        mutations: [
          {
            baseRevision: null,
            entityType: 'goal',
            payload: { id: 'goal-1' },
          },
        ],
        operationId: '30000000-0000-0000-0000-000000000003',
        scope,
      }),
    ).rejects.toThrow(
      'Account operation batch supports calendar entities only.',
    );

    await expect(
      applyAccountOperationBatch({
        mutations: Array.from({ length: 101 }, () => ({
          baseRevision: null,
          entityType: 'categoryTag' as const,
          payload: { id: 'category-1' },
        })),
        operationId: '40000000-0000-0000-0000-000000000004',
        scope,
      }),
    ).rejects.toThrow(
      'Account operation batch must contain 1 to 100 mutations.',
    );

    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it('preserves the structured RPC error for retry and conflict handling', async () => {
    const rpcError = {
      code: '40001',
      details: null,
      hint: null,
      message: 'stale_revision',
    };
    const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      rpc,
    } as unknown as SupabaseClient);

    await expect(
      applyAccountOperationBatch({
        mutations: [
          {
            baseRevision: 1,
            entityType: 'categoryTag',
            payload: {
              id: 'category-1',
              name: 'Stale',
              colorHex: '#112233',
              position: 'a0',
              surface: 'calendar',
              useOwnName: false,
              createdAt: '2026-08-18T12:00:00.000Z',
              updatedAt: '2026-08-18T12:00:00.000Z',
              deletedAt: null,
              clientUpdatedAt: '2026-08-18T13:00:00.000Z',
            },
          },
        ],
        operationId: '50000000-0000-0000-0000-000000000005',
        scope: createUserScope('authenticated-user'),
      }),
    ).rejects.toBe(rpcError);
  });
});
