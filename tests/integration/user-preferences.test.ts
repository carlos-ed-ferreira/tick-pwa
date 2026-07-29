import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import { db, getLocalPreference, setScopedPreference } from '@/lib/db';
import { waitForAccountPersistence } from '@/lib/db/account-persistence';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

describe('scoped user preferences', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('keeps guest preferences in IndexedDB and away from Supabase', async () => {
    const scope = createGuestScope('local-device');

    await setScopedPreference({
      key: 'taskTreeRowActions',
      scope,
      value: { add: 'inline' },
    });

    await expect(
      getLocalPreference('taskTreeRowActions', scope),
    ).resolves.toEqual({ add: 'inline' });
    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it('commits account preferences locally before persisting them by user', async () => {
    const scope = createUserScope('account-owner');
    let resolveWrite!: (value: { data: null; error: null }) => void;
    const write = new Promise<{ data: null; error: null }>((resolve) => {
      resolveWrite = resolve;
    });
    const upsert = vi.fn(() => write);
    const from = vi.fn(() => ({ upsert }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    await setScopedPreference({
      key: 'taskTreeRowActions',
      scope,
      value: { priority: 'menu' },
    });

    await expect(
      getLocalPreference('taskTreeRowActions', scope),
    ).resolves.toEqual({ priority: 'menu' });
    expect(from).toHaveBeenCalledWith('user_preferences');
    expect(upsert).toHaveBeenCalledWith(
      {
        key: 'taskTreeRowActions',
        user_id: scope.ownerId,
        value: { priority: 'menu' },
      },
      { onConflict: 'user_id,key' },
    );

    resolveWrite({ data: null, error: null });
    await waitForAccountPersistence(scope.id);
  });
});
