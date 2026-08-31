import type { AccountRefreshRun } from '@/lib/supabase/account-refresh-coordinator';
import { captureTelemetry } from './browser';

export function reportAccountRefreshTelemetry(
  run: AccountRefreshRun | null | undefined,
): void {
  if (!run?.metrics) {
    return;
  }

  captureTelemetry('account_refresh', 'info', {
    durationMs: run.metrics.durationMs,
    reason: run.reason,
    result: 'completed',
    totalPages: run.metrics.totalPages,
    totalRows: run.metrics.totalRows,
  });
}

export function reportAccountRefreshFailure(reason: string): void {
  captureTelemetry('account_refresh', 'error', {
    reason,
    result: 'failed',
  });
}
