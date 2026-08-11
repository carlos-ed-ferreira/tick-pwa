import type { AppScope } from '@/lib/domain';
import type { AccountCacheRefreshResult } from './account-cache';

export type AccountRefreshReason = 'focus' | 'manual' | 'online' | 'session';

export interface AccountRefreshRun {
  completedAt: number;
  metrics: AccountCacheRefreshResult | null;
  reason: AccountRefreshReason;
  startedAt: number;
}

export class AccountRefreshCoordinator {
  private readonly inFlightByScope = new Map<
    string,
    Promise<AccountRefreshRun>
  >();
  private readonly lastCompletedAtByScope = new Map<string, number>();

  constructor(
    private readonly refreshCache: (
      scope: AppScope,
    ) => Promise<AccountCacheRefreshResult | null>,
    private readonly now: () => number = Date.now,
    private readonly staleAfterMs = 60_000,
  ) {}

  refresh(
    scope: AppScope,
    reason: AccountRefreshReason,
    force = false,
  ): Promise<AccountRefreshRun | null> {
    const inFlight = this.inFlightByScope.get(scope.id);

    if (inFlight) {
      return inFlight;
    }

    const requestedAt = this.now();
    const lastCompletedAt = this.lastCompletedAtByScope.get(scope.id);

    if (
      !force &&
      lastCompletedAt !== undefined &&
      requestedAt - lastCompletedAt < this.staleAfterMs
    ) {
      return Promise.resolve(null);
    }

    const refresh = this.refreshCache(scope)
      .then((metrics) => {
        const completedAt = this.now();
        this.lastCompletedAtByScope.set(scope.id, completedAt);

        return {
          completedAt,
          metrics,
          reason,
          startedAt: requestedAt,
        } satisfies AccountRefreshRun;
      })
      .finally(() => {
        if (this.inFlightByScope.get(scope.id) === refresh) {
          this.inFlightByScope.delete(scope.id);
        }
      });

    this.inFlightByScope.set(scope.id, refresh);

    return refresh;
  }
}
