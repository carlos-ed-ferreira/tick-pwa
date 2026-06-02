import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

import { isUserAllowed } from '@/lib/supabase/auth';

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

    await expect(isUserAllowed(createUser('User@Example.com'))).resolves.toBe(
      true,
    );

    expect(access.from).toHaveBeenCalledWith('account_access');
    expect(access.select).toHaveBeenCalledWith('active');
    expect(access.eq).toHaveBeenCalledWith('email', 'user@example.com');
    expect(access.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('rejects inactive, missing, and errored allowlist checks', async () => {
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
      isUserAllowed(createUser('inactive@example.com')),
    ).resolves.toBe(false);
    await expect(
      isUserAllowed(createUser('missing@example.com')),
    ).resolves.toBe(false);
    await expect(isUserAllowed(createUser('error@example.com'))).resolves.toBe(
      false,
    );

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

  it('rejects checks without a Supabase client or user email', async () => {
    const access = createAccessClient({ data: { active: true } });

    supabaseMocks.getSupabaseBrowserClient.mockReturnValueOnce(null);
    await expect(isUserAllowed(createUser('user@example.com'))).resolves.toBe(
      false,
    );

    supabaseMocks.getSupabaseBrowserClient.mockReturnValueOnce(access.client);
    await expect(isUserAllowed(createUser(null))).resolves.toBe(false);
    expect(access.from).not.toHaveBeenCalled();
  });
});
