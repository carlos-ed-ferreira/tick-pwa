import type { User } from '@supabase/supabase-js';
import { afterEach, expect, it, vi } from 'vitest';
import {
  checkUserAccess,
  resolveUserAccess,
  ensureUserProfile,
} from '@/lib/supabase/auth';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ from: mocks.from }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  mocks.from.mockReset();
});

it('defers profile metadata when the connection drops after authorization, while preserving permission failures', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const user = {
    id: 'offline-owner',
    email: 'offline@example.test',
    user_metadata: {},
  } as User;
  const upsert = vi
    .fn()
    .mockResolvedValueOnce({
      error: { message: 'TypeError: Failed to fetch', code: '' },
    })
    .mockResolvedValueOnce({
      error: { code: '42501', message: 'Permission denied' },
    });
  mocks.from.mockReturnValue({ upsert });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(ensureUserProfile(user)).resolves.toBeUndefined();
  expect(log).toHaveBeenCalled();
  await expect(ensureUserProfile(user)).rejects.toMatchObject({
    code: '42501',
  });
});

it('uses a valid local grant while offline without consulting a potentially cached remote allowlist response', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { active: true }, error: null }),
      }),
    }),
  });
  const user = { id: 'offline-owner', email: 'offline@example.test' } as User;
  const remoteStatus = await checkUserAccess(user);
  await ensureUserProfile(user);
  expect(remoteStatus).toBe('unavailable');
  expect(mocks.from).not.toHaveBeenCalled();
  const now = new Date('2026-11-03T15:00:00Z');
  expect(
    resolveUserAccess({
      user,
      remoteStatus,
      now,
      cached: {
        userId: user.id,
        email: user.email!,
        verifiedAt: now.toISOString(),
      },
    }),
  ).toBe('allowed');
  expect(
    resolveUserAccess({
      user,
      remoteStatus,
      now,
      cached: {
        userId: user.id,
        email: user.email!,
        verifiedAt: '2026-11-01T15:00:00Z',
      },
    }),
  ).toBe('unavailable');
});

function mockAccessQueryError(error: object) {
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error }),
      }),
    }),
  });
}

it('treats a dropped connection during the access check as unavailable without reporting an error', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  mockAccessQueryError({ message: 'TypeError: Failed to fetch', code: '' });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const user = { id: 'owner', email: 'owner@example.test' } as User;

  await expect(checkUserAccess(user)).resolves.toBe('unavailable');
  expect(log).not.toHaveBeenCalled();
});

it('reports the readable cause when the access check fails on the server', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  mockAccessQueryError(
    Object.assign(new Error('JWT could not be verified'), {
      code: 'PGRST301',
      details: 'JWSInvalidSignature',
      hint: '',
    }),
  );
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const user = { id: 'owner', email: 'owner@example.test' } as User;

  await expect(checkUserAccess(user)).resolves.toBe('unavailable');
  expect(log).toHaveBeenCalledWith('Failed to verify Tick account access.', {
    code: 'PGRST301',
    details: 'JWSInvalidSignature',
    hint: '',
    message: 'JWT could not be verified',
  });
});
