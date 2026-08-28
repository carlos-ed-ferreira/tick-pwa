import { describe, expect, it, vi } from 'vitest';
import { createUserScope } from '@/lib/domain';
import { AccountRefreshCoordinator } from '@/lib/supabase/account-refresh-coordinator';

describe('AccountRefreshCoordinator', () => {
  it('shares one in-flight refresh between concurrent requests', async () => {
    const scope = createUserScope('concurrent-refresh-user');
    let completeRefresh!: () => void;
    const refreshCache = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          completeRefresh = () => resolve(null);
        }),
    );
    const coordinator = new AccountRefreshCoordinator(refreshCache);

    const sessionRefresh = coordinator.refresh(scope, 'session');
    const focusRefresh = coordinator.refresh(scope, 'focus');

    expect(refreshCache).toHaveBeenCalledTimes(1);
    completeRefresh();
    await expect(sessionRefresh).resolves.toMatchObject({ reason: 'session' });
    await expect(focusRefresh).resolves.toMatchObject({ reason: 'session' });
  });

  it('skips event refreshes while data is fresh and allows a forced manual refresh', async () => {
    const scope = createUserScope('fresh-refresh-user');
    let currentTime = 1000;
    const refreshCache = vi.fn().mockResolvedValue(null);
    const coordinator = new AccountRefreshCoordinator(
      refreshCache,
      () => currentTime,
      60_000,
    );

    await coordinator.refresh(scope, 'session');
    currentTime += 30_000;

    await expect(coordinator.refresh(scope, 'focus')).resolves.toBeNull();
    await expect(
      coordinator.refresh(scope, 'manual', true),
    ).resolves.toMatchObject({ reason: 'manual' });
    expect(refreshCache).toHaveBeenCalledTimes(2);
  });

  it('refreshes stale data and tracks freshness separately for each account', async () => {
    const firstScope = createUserScope('first-refresh-user');
    const secondScope = createUserScope('second-refresh-user');
    let currentTime = 1000;
    const refreshCache = vi.fn().mockResolvedValue(null);
    const coordinator = new AccountRefreshCoordinator(
      refreshCache,
      () => currentTime,
      60_000,
    );

    await coordinator.refresh(firstScope, 'session');
    currentTime += 60_001;
    await coordinator.refresh(firstScope, 'online');
    await coordinator.refresh(secondScope, 'focus');

    expect(refreshCache).toHaveBeenCalledTimes(3);
    expect(refreshCache).toHaveBeenLastCalledWith(secondScope);
  });

  it('does not start a remote refresh while the browser is offline', async () => {
    const scope = createUserScope('offline-refresh-user');
    const refreshCache = vi.fn().mockResolvedValue(null);
    const coordinator = new AccountRefreshCoordinator(
      refreshCache,
      Date.now,
      60_000,
      () => false,
    );

    await expect(coordinator.refresh(scope, 'focus')).resolves.toBeNull();
    expect(refreshCache).not.toHaveBeenCalled();
  });
});
