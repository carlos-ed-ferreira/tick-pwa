import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

import { checkUserAccess, resolveUserAccess } from '@/lib/supabase/auth';

function createUser(email: string | null): User {
  return {
    email,
    id: 'user-id',
    user_metadata: {},
  } as User;
}

function createAccessClient({
  data,
  error = null,
}: {
  data: { active?: boolean } | null;
  error?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from },
    eq,
    from,
    maybeSingle,
    select,
  };
}

describe('account allowlist checks', () => {
  afterEach(() => {
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    vi.restoreAllMocks();
  });

  it('allows users with an active allowlist row', async () => {
    const access = createAccessClient({ data: { active: true } });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(access.client);

    await expect(checkUserAccess(createUser('User@Example.com'))).resolves.toBe(
      'allowed',
    );

    expect(access.from).toHaveBeenCalledWith('account_access');
    expect(access.select).toHaveBeenCalledWith('active');
    expect(access.eq).toHaveBeenCalledWith('email', 'user@example.com');
    expect(access.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('distinguishes denied access from an unavailable allowlist', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const inactiveAccess = createAccessClient({ data: { active: false } });
    const missingAccess = createAccessClient({ data: null });
    const erroredAccess = createAccessClient({
      data: null,
      error: { message: 'network unavailable' },
    });

    supabaseMocks.getSupabaseBrowserClient
      .mockReturnValueOnce(inactiveAccess.client)
      .mockReturnValueOnce(missingAccess.client)
      .mockReturnValueOnce(erroredAccess.client);

    await expect(
      checkUserAccess(createUser('inactive@example.com')),
    ).resolves.toBe('denied');
    await expect(
      checkUserAccess(createUser('missing@example.com')),
    ).resolves.toBe('denied');
    await expect(
      checkUserAccess(createUser('error@example.com')),
    ).resolves.toBe('unavailable');

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

  it('rejects checks without a Supabase client or user email', async () => {
    const access = createAccessClient({ data: { active: true } });

    supabaseMocks.getSupabaseBrowserClient.mockReturnValueOnce(null);
    await expect(checkUserAccess(createUser('user@example.com'))).resolves.toBe(
      'unavailable',
    );

    supabaseMocks.getSupabaseBrowserClient.mockReturnValueOnce(access.client);
    await expect(checkUserAccess(createUser(null))).resolves.toBe('denied');
    expect(access.from).not.toHaveBeenCalled();
  });

  it('treats a thrown network failure as unavailable', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const maybeSingle = vi.fn().mockRejectedValue(new Error('offline'));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });

    await expect(checkUserAccess(createUser('user@example.com'))).resolves.toBe(
      'unavailable',
    );
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

  it('uses only a recent cached grant for the same user and email while offline', () => {
    const user = createUser('User@Example.com');
    const verifiedAt = '2026-08-17T12:00:00.000Z';

    expect(
      resolveUserAccess({
        cached: {
          email: 'user@example.com',
          userId: 'user-id',
          verifiedAt,
        },
        now: new Date('2026-08-18T11:59:59.000Z'),
        remoteStatus: 'unavailable',
        user,
      }),
    ).toBe('allowed');
    expect(
      resolveUserAccess({
        cached: {
          email: 'user@example.com',
          userId: 'user-id',
          verifiedAt,
        },
        now: new Date('2026-08-18T12:00:01.000Z'),
        remoteStatus: 'unavailable',
        user,
      }),
    ).toBe('unavailable');
    expect(
      resolveUserAccess({
        cached: {
          email: 'other@example.com',
          userId: 'user-id',
          verifiedAt,
        },
        now: new Date('2026-08-17T13:00:00.000Z'),
        remoteStatus: 'unavailable',
        user,
      }),
    ).toBe('unavailable');
    expect(
      resolveUserAccess({
        cached: {
          email: 'user@example.com',
          userId: 'another-user',
          verifiedAt,
        },
        now: new Date('2026-08-17T13:00:00.000Z'),
        remoteStatus: 'unavailable',
        user,
      }),
    ).toBe('unavailable');
    expect(
      resolveUserAccess({
        cached: null,
        now: new Date('2026-08-17T13:00:00.000Z'),
        remoteStatus: 'denied',
        user,
      }),
    ).toBe('denied');
  });
});
