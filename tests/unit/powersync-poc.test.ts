import { UpdateType } from '@powersync/web';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { TickPowerSyncPocConnector } from '@/lib/powersync/connector';
import { createPowerSyncPocScenario } from '@/lib/powersync/poc-commands';
import { PowerSyncPocLifecycle } from '@/lib/powersync/lifecycle';
import { createPowerSyncPocMutation } from '@/lib/powersync/mutation';
import { getPowerSyncPocDatabaseFilename } from '@/lib/powersync/runtime';
import { PowerSyncPocSession } from '@/lib/powersync/session';
import { PowerSyncPocStore } from '@/lib/powersync/store';
import { createGuestScope, createUserScope } from '@/lib/domain';
import { normalizePowerSyncPayload } from '@/lib/powersync/payload';
import { tickPowerSyncPocSchema } from '@/lib/powersync/schema';

describe('PowerSync proof of concept', () => {
  it('derives ownership and converts SQLite values for Supabase writes', () => {
    expect(
      normalizePowerSyncPayload({
        table: 'category_tags',
        payload: {
          name: 'FOCUS',
          user_id: 'untrusted-user',
          use_own_name: 1,
        },
        userId: 'authenticated-user',
      }),
    ).toEqual({
      name: 'FOCUS',
      user_id: 'authenticated-user',
      use_own_name: true,
    });

    expect(
      normalizePowerSyncPayload({
        table: 'daily_entries',
        payload: {
          category_summaries: '[{"categoryTagId":"tag-1"}]',
          category_tag_ids: '["tag-1"]',
        },
        userId: 'authenticated-user',
      }),
    ).toEqual({
      category_summaries: [{ categoryTagId: 'tag-1' }],
      category_tag_ids: ['tag-1'],
      user_id: 'authenticated-user',
    });

    expect(
      normalizePowerSyncPayload({
        table: 'checklist_items',
        payload: {
          bold: 0,
          checked: 1,
          collapsed: 0,
          ignored: 0,
          priority: 1,
        },
        userId: 'authenticated-user',
      }),
    ).toEqual({
      bold: false,
      checked: true,
      collapsed: false,
      ignored: false,
      priority: true,
      user_id: 'authenticated-user',
    });
  });

  it('defines the simple entity and complete checklist hierarchy', () => {
    expect(tickPowerSyncPocSchema.tables.map((table) => table.name)).toEqual([
      'category_tags',
      'daily_entries',
      'checklist_items',
    ]);
    expect(() => tickPowerSyncPocSchema.validate()).not.toThrow();
  });

  it('uses the current Supabase JWT and derives ownership during upload', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'supabase-access-token',
              user: { id: 'authenticated-user' },
            },
          },
          error: null,
        }),
      },
      from: vi.fn(() => ({ upsert })),
    } as unknown as SupabaseClient;
    const connector = new TickPowerSyncPocConnector(
      'https://example.powersync.journeyapps.com',
      () => client,
    );
    const database = {
      getNextCrudTransaction: vi.fn().mockResolvedValue({
        complete,
        crud: [
          {
            id: 'tag-1',
            op: UpdateType.PUT,
            opData: {
              name: 'FOCUS',
              user_id: 'untrusted-user',
              use_own_name: 1,
            },
            table: 'category_tags',
          },
        ],
      }),
    };

    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: 'https://example.powersync.journeyapps.com',
      token: 'supabase-access-token',
    });
    await connector.uploadData(database as never);

    expect(upsert).toHaveBeenCalledWith(
      {
        id: 'tag-1',
        name: 'FOCUS',
        user_id: 'authenticated-user',
        use_own_name: true,
      },
      { onConflict: 'id' },
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('isolates the local PowerSync database when the account scope changes', async () => {
    const firstDatabase = {
      close: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
    };
    const secondDatabase = {
      close: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
    };
    const connector = {
      fetchCredentials: vi.fn(),
      uploadData: vi.fn(),
    };
    const createDatabase = vi
      .fn()
      .mockReturnValueOnce({ connector, database: firstDatabase })
      .mockReturnValueOnce({ connector, database: secondDatabase });
    const lifecycle = new PowerSyncPocLifecycle(createDatabase);
    const firstScope = createUserScope('first-user');
    const secondScope = createUserScope('second-user');

    await lifecycle.start(firstScope);
    await lifecycle.start(firstScope);
    await lifecycle.start(secondScope);
    await lifecycle.start(createGuestScope('guest-installation'));

    expect(createDatabase).toHaveBeenCalledTimes(2);
    expect(firstDatabase.connect).toHaveBeenCalledOnce();
    expect(firstDatabase.close).toHaveBeenCalledOnce();
    expect(secondDatabase.connect).toHaveBeenCalledOnce();
    expect(secondDatabase.close).toHaveBeenCalledOnce();
  });

  it('uses a bounded account-specific database filename', () => {
    expect(
      getPowerSyncPocDatabaseFilename(
        createUserScope('2f784ca2-bc84-4420-a5ef-02d260c73dc4'),
      ),
    ).toBe('tick-powersync-poc-2f784ca2-bc84-4420-a5ef-02d260c73dc4.db');
    expect(() =>
      getPowerSyncPocDatabaseFilename(createUserScope('../another-user')),
    ).toThrow('Invalid PowerSync account identifier.');
  });

  it('builds an account-owned offline insert using SQLite-compatible values', () => {
    const mutation = createPowerSyncPocMutation({
      baseRevision: null,
      entityType: 'categoryTag',
      payload: {
        id: 'tag-1',
        scopeId: 'user:untrusted-user',
        name: 'FOCUS',
        colorHex: '#112233',
        surface: 'checklist_item',
        position: 'a0',
        useOwnName: true,
        createdAt: '2026-08-11T10:00:00.000Z',
        updatedAt: '2026-08-11T10:00:00.000Z',
        deletedAt: null,
        clientUpdatedAt: '2026-08-11T10:00:00.000Z',
      },
      scope: createUserScope('authenticated-user'),
    });

    expect(mutation).toEqual({
      parameters: [
        'tag-1',
        'authenticated-user',
        '2026-08-11T10:00:00.000Z',
        '2026-08-11T10:00:00.000Z',
        null,
        '2026-08-11T10:00:00.000Z',
        'FOCUS',
        '#112233',
        'a0',
        'checklist_item',
        1,
      ],
      sql: 'INSERT INTO category_tags (id, user_id, created_at, updated_at, deleted_at, client_updated_at, name, color_hex, position, surface, use_own_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    });
  });

  it('does not create a PowerSync mutation for guest data', () => {
    expect(
      createPowerSyncPocMutation({
        baseRevision: null,
        entityType: 'categoryTag',
        payload: {},
        scope: createGuestScope('guest-installation'),
      }),
    ).toBeNull();
  });

  it('reads only the authenticated account and writes through local SQLite', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const getAll = vi.fn(async (sql: string) => {
      if (sql.includes('category_tags')) {
        return [
          {
            id: 'tag-1',
            user_id: 'authenticated-user',
            name: 'FOCUS',
            color_hex: '#112233',
            surface: 'checklist_item',
            position: 'a0',
            use_own_name: 1,
            created_at: '2026-08-11T10:00:00.000Z',
            updated_at: '2026-08-11T10:00:00.000Z',
            deleted_at: null,
            client_updated_at: '2026-08-11T10:00:00.000Z',
            revision: 1,
          },
          {
            id: 'foreign-tag',
            user_id: 'another-user',
            name: 'PRIVATE',
            color_hex: '#445566',
            surface: 'checklist_item',
            position: 'b0',
            use_own_name: 0,
            created_at: '2026-08-11T10:00:00.000Z',
            updated_at: '2026-08-11T10:00:00.000Z',
            deleted_at: null,
            client_updated_at: '2026-08-11T10:00:00.000Z',
            revision: 1,
          },
        ];
      }

      return [];
    });
    const store = new PowerSyncPocStore({
      execute,
      getAll,
      writeTransaction: vi.fn(),
    });
    const scope = createUserScope('authenticated-user');

    await expect(store.readSnapshot(scope)).resolves.toMatchObject({
      categoryTags: [
        {
          id: 'tag-1',
          scopeId: 'user:authenticated-user',
          useOwnName: true,
        },
      ],
      checklistItems: [],
      dailyEntries: [],
    });
    await expect(
      store.write({
        baseRevision: null,
        entityType: 'categoryTag',
        payload: {
          id: 'tag-1',
          name: 'FOCUS',
          colorHex: '#112233',
          surface: 'checklist_item',
          position: 'a0',
          useOwnName: true,
          createdAt: '2026-08-11T10:00:00.000Z',
          updatedAt: '2026-08-11T10:00:00.000Z',
          deletedAt: null,
          clientUpdatedAt: '2026-08-11T10:00:00.000Z',
        },
        scope,
      }),
    ).resolves.toBe(true);
    await expect(
      store.write({
        baseRevision: null,
        entityType: 'categoryTag',
        payload: {},
        scope: createGuestScope('guest-installation'),
      }),
    ).resolves.toBe(false);

    expect(getAll).toHaveBeenCalledTimes(3);
    expect(getAll).toHaveBeenCalledWith(
      'SELECT * FROM category_tags WHERE user_id = ?',
      ['authenticated-user'],
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it('exposes the active store only to its exact authenticated scope', async () => {
    const readSnapshot = vi.fn().mockResolvedValue({
      categoryTags: [],
      checklistItems: [],
      dailyEntries: [],
    });
    const write = vi.fn().mockResolvedValue(true);
    const session = new PowerSyncPocSession();
    const ownerScope = createUserScope('owner-user');

    session.activate(ownerScope, { readSnapshot, write });

    await expect(session.readSnapshot(ownerScope)).resolves.toEqual({
      categoryTags: [],
      checklistItems: [],
      dailyEntries: [],
    });
    await expect(
      session.readSnapshot(createUserScope('another-user')),
    ).rejects.toThrow('PowerSync proof is not active for this account.');
    await expect(
      session.readSnapshot(createGuestScope('guest-installation')),
    ).rejects.toThrow('PowerSync proof is not active for this account.');

    session.deactivate(ownerScope);
    await expect(session.readSnapshot(ownerScope)).rejects.toThrow(
      'PowerSync proof is not active for this account.',
    );
  });

  it('creates a simple entity and a complete hierarchy only in PowerSync', async () => {
    const writeMany = vi.fn().mockResolvedValue(true);
    const ids = ['category-1', 'entry-1', 'parent-1', 'child-1'];

    const result = await createPowerSyncPocScenario({
      categoryName: 'OFFLINE',
      childText: 'Nested task',
      createId: () => ids.shift()!,
      date: '2026-08-11',
      now: () => '2026-08-11T12:00:00.000Z',
      parentText: 'Main task',
      scope: createUserScope('authenticated-user'),
      timezone: 'America/Sao_Paulo',
      writeMany,
    });

    expect(
      writeMany.mock.calls[0][0].map(
        (change: { entityType: string }) => change.entityType,
      ),
    ).toEqual(['categoryTag', 'dailyEntry', 'checklistItem', 'checklistItem']);
    expect(result.parentItem.parentId).toBeNull();
    expect(result.childItem.parentId).toBe('parent-1');
    expect(result.childItem.dailyEntryId).toBe('entry-1');
    expect(result.category.scopeId).toBe('user:authenticated-user');
  });

  it('commits the complete proof scenario in one local SQLite transaction', async () => {
    const transactionExecute = vi.fn().mockResolvedValue(undefined);
    const writeTransaction = vi.fn(async (action) => {
      await action({ execute: transactionExecute });
    });
    const store = new PowerSyncPocStore({
      execute: vi.fn(),
      getAll: vi.fn(),
      writeTransaction,
    });
    const ids = ['category-1', 'entry-1', 'parent-1', 'child-1'];

    await createPowerSyncPocScenario({
      categoryName: 'OFFLINE',
      childText: 'Nested task',
      createId: () => ids.shift()!,
      date: '2026-08-11',
      now: () => '2026-08-11T12:00:00.000Z',
      parentText: 'Main task',
      scope: createUserScope('authenticated-user'),
      timezone: 'America/Sao_Paulo',
      writeMany: (changes) => store.writeMany(changes),
    });

    expect(writeTransaction).toHaveBeenCalledOnce();
    expect(transactionExecute).toHaveBeenCalledTimes(4);
  });
});
