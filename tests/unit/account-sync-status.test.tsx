import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserScope } from '@/lib/domain';
import { useAccountSyncStatus } from '@/features/auth/use-account-sync-status';
import type { AccountSyncSummary } from '@/lib/db/account-persistence';

const { forceSyncAccountMock, useLiveQueryMock } = vi.hoisted(() => ({
  forceSyncAccountMock: vi.fn().mockResolvedValue(undefined),
  useLiveQueryMock: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: useLiveQueryMock,
}));

vi.mock('@/lib/db/account-persistence', () => ({
  forceSyncAccount: forceSyncAccountMock,
  getAccountSyncSummary: vi.fn(),
}));

function createSummary(
  state: AccountSyncSummary['state'],
  counts: Partial<AccountSyncSummary> = {},
): AccountSyncSummary {
  return {
    state,
    failedCount: 0,
    pendingCount: 0,
    syncingCount: 0,
    ...counts,
  };
}

describe('useAccountSyncStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    useLiveQueryMock.mockReset();
  });

  it('hides a sync cycle that finishes before the visibility delay', () => {
    const scope = createUserScope('quiet-indicator-user');
    useLiveQueryMock.mockReturnValue(createSummary('saved'));

    const { rerender, result } = renderHook(() => useAccountSyncStatus(scope));

    expect(result.current.summary.state).toBe('saved');

    useLiveQueryMock.mockReturnValue(
      createSummary('pending', { pendingCount: 1 }),
    );
    rerender();

    expect(result.current.summary.state).toBe('saved');

    useLiveQueryMock.mockReturnValue(
      createSummary('syncing', { syncingCount: 1 }),
    );
    rerender();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.summary.state).toBe('saved');

    useLiveQueryMock.mockReturnValue(createSummary('saved'));
    rerender();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.summary.state).toBe('saved');
  });

  it('shows a sync that stays active beyond the visibility delay', () => {
    const scope = createUserScope('slow-indicator-user');
    useLiveQueryMock.mockReturnValue(createSummary('saved'));

    const { rerender, result } = renderHook(() => useAccountSyncStatus(scope));

    useLiveQueryMock.mockReturnValue(
      createSummary('syncing', { syncingCount: 1 }),
    );
    rerender();
    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(result.current.summary).toMatchObject({
      state: 'syncing',
      syncingCount: 1,
    });
  });

  it('keeps a longer queue visible without restarting the delay', () => {
    const scope = createUserScope('growing-queue-user');
    useLiveQueryMock.mockReturnValue(createSummary('saved'));

    const { rerender, result } = renderHook(() => useAccountSyncStatus(scope));

    useLiveQueryMock.mockReturnValue(
      createSummary('pending', { pendingCount: 1 }),
    );
    rerender();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    useLiveQueryMock.mockReturnValue(
      createSummary('pending', { pendingCount: 2 }),
    );
    rerender();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.summary).toMatchObject({
      pendingCount: 2,
      state: 'pending',
    });
  });

  it('reports a failure without waiting for the visibility delay', () => {
    const scope = createUserScope('failed-indicator-user');
    useLiveQueryMock.mockReturnValue(createSummary('saved'));

    const { rerender, result } = renderHook(() => useAccountSyncStatus(scope));

    useLiveQueryMock.mockReturnValue(
      createSummary('failed', { failedCount: 1 }),
    );
    rerender();

    expect(result.current.summary).toMatchObject({
      failedCount: 1,
      state: 'failed',
    });
  });
});
