import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import { db, getLocalPreference, setScopedPreference } from '@/lib/db';
import {
  getAccountSyncSummary,
  resumeAccountPersistence,
  waitForAccountPersistence,
} from '@/lib/db/account-persistence';
import { refreshAccountPreferences } from '@/lib/supabase/account-preferences';
import { resumeAccountPreferences } from '@/lib/db/account-preference-outbox';
import * as metadata from '@/lib/db/entity-metadata';

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
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('stops automatic retries at the limit and allows an explicit retry after reopening', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const scope = createUserScope('limited-preference-user');
    const upsert = vi
      .fn()
      .mockResolvedValue({ error: { code: 'unavailable' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ upsert }),
    });
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    await waitForAccountPersistence(scope.id);
    for (const delay of [1000, 2000, 4000, 8000]) {
      await vi.advanceTimersByTimeAsync(delay);
      await waitForAccountPersistence(scope.id);
    }
    expect(upsert).toHaveBeenCalledTimes(5);
    db.close();
    await db.open();
    await resumeAccountPreferences(scope);
    await vi.advanceTimersByTimeAsync(60000);
    await waitForAccountPersistence(scope.id);
    expect(upsert).toHaveBeenCalledTimes(5);
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
    upsert.mockResolvedValue({ error: null });
    await resumeAccountPreferences(scope, true);
    expect(upsert).toHaveBeenCalledTimes(6);
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'saved',
    });
  });

  it('restores a retry deadline after reopening without sending before it is due', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const scope = createUserScope('delayed-preference-user');
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: 'unavailable' } })
      .mockResolvedValue({ error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ upsert }),
    });
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    await waitForAccountPersistence(scope.id);
    vi.clearAllTimers();
    db.close();
    await db.open();
    await resumeAccountPreferences(scope);
    await vi.advanceTimersByTimeAsync(999);
    expect(upsert).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await waitForAccountPersistence(scope.id);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('merges canonical remote preferences and deletions when there is no local intent', async () => {
    const scope = createUserScope('canonical-preference-user');
    let remote: { key: string; value: unknown }[] | null = [
      { key: 'checklistViewMode', value: 'tabs' },
    ];
    const select = vi.fn(async () => ({ data: remote, error: null }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ select }),
    });
    await refreshAccountPreferences(scope);
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
    await refreshAccountPreferences(scope);
    remote = null;
    await refreshAccountPreferences(scope);
    await expect(
      getLocalPreference('checklistViewMode', scope),
    ).resolves.toBeNull();
    const guest = createGuestScope('remote-guest');
    await resumeAccountPreferences(guest);
    await refreshAccountPreferences(guest);
    expect(select).toHaveBeenCalledTimes(3);
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
    await vi.waitFor(() =>
      expect(from).toHaveBeenCalledWith('user_preferences'),
    );
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
  it('keeps an offline preference durable across reopening and a stale pull, then resumes it', async () => {
    const scope = createUserScope('offline-preference-user');
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      upsert,
      select: vi.fn().mockResolvedValue({
        data: [{ key: 'checklistViewMode', value: 'list' }],
        error: null,
      }),
    }));
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({ from });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    await waitForAccountPersistence(scope.id);
    expect(upsert).not.toHaveBeenCalled();
    db.close();
    await db.open();
    await refreshAccountPreferences(scope);
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'pending',
      pendingCount: 1,
    });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await resumeAccountPersistence(scope);
    await waitForAccountPersistence(scope.id);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: scope.ownerId, value: 'tabs' }),
      expect.anything(),
    );
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'saved',
    });
    vi.restoreAllMocks();
  });

  it('does not let an old preference response overwrite a write acknowledged during the read', async () => {
    const scope = createUserScope('preference-read-race');
    let release!: (value: unknown) => void;
    const response = new Promise((resolve) => {
      release = resolve;
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ upsert, select: () => response }),
    });
    const refresh = refreshAccountPreferences(scope);
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    await waitForAccountPersistence(scope.id);
    release({
      data: [{ key: 'checklistViewMode', value: 'list' }],
      error: null,
    });
    await refresh;
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
  });

  it('protects a preference already pending when a pull starts and acknowledged before the response', async () => {
    const scope = createUserScope('pending-pull-preference-user');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    await waitForAccountPersistence(scope.id);
    let release!: (value: unknown) => void;
    const response = new Promise((resolve) => {
      release = resolve;
    });
    const select = vi.fn(() => response);
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ select, upsert: async () => ({ error: null }) }),
    });
    const refresh = refreshAccountPreferences(scope);
    await vi.waitFor(() => expect(select).toHaveBeenCalledOnce());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await resumeAccountPreferences(scope);
    release({
      data: [{ key: 'checklistViewMode', value: 'list' }],
      error: null,
    });
    await refresh;
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
  });

  it('does not send another account preference while resuming this account', async () => {
    const first = createUserScope('first-preference-user');
    const second = createUserScope('second-preference-user');
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ upsert }),
    });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await setScopedPreference({
      key: 'checklistViewMode',
      scope: first,
      value: 'tabs',
    });
    await setScopedPreference({
      key: 'checklistViewMode',
      scope: second,
      value: 'list',
    });
    await waitForAccountPersistence();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await resumeAccountPersistence(first);
    await waitForAccountPersistence();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: first.ownerId }),
      expect.anything(),
    );
    await expect(getAccountSyncSummary(second.id)).resolves.toMatchObject({
      state: 'pending',
    });
    vi.restoreAllMocks();
  });

  it('keeps failed writes visible and retries the same value without restoring remote data', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const scope = createUserScope('failed-preference-user');
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: 'unavailable' } })
      .mockResolvedValue({ error: null });
    const select = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ upsert, select }),
    });
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    await waitForAccountPersistence(scope.id);
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'failed',
      failedCount: 1,
    });
    expect(select).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    await waitForAccountPersistence(scope.id);
    expect(upsert).toHaveBeenCalledTimes(2);
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'saved',
    });
    expect(log).toHaveBeenCalled();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not mark a newer preference synchronized when an older response arrives', async () => {
    vi.spyOn(metadata, 'createTimestamp').mockReturnValue(
      '2026-11-03T15:00:00.000Z',
    );
    const scope = createUserScope('newer-preference-user');
    let acknowledge!: (response: { error: null }) => void;
    const response = new Promise<{ error: null }>((resolve) => {
      acknowledge = resolve;
    });
    const upsert = vi
      .fn()
      .mockReturnValueOnce(response)
      .mockResolvedValue({ error: null });
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue({
      from: () => ({ upsert }),
    });
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'list',
    });
    await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    await setScopedPreference({
      key: 'checklistViewMode',
      scope,
      value: 'tabs',
    });
    acknowledge({ error: null });
    await waitForAccountPersistence(scope.id);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0].value).toBe('tabs');
    await expect(getLocalPreference('checklistViewMode', scope)).resolves.toBe(
      'tabs',
    );
    await expect(getAccountSyncSummary(scope.id)).resolves.toMatchObject({
      state: 'saved',
    });
  });
});
