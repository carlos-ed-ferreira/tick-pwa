import { getAccountSyncMetrics } from '@/lib/db/account-sync-metrics';
import { captureTelemetry } from './browser';

const SUCCESS_REPORT_INTERVAL_MS = 300_000;
const lastSuccessReportByScope = new Map<string, number>();

export async function reportAccountSyncTelemetry(
  scopeId: string,
): Promise<void> {
  const metrics = await getAccountSyncMetrics(scopeId);
  const isFailure =
    metrics.lastBatchResult === 'rejected' ||
    metrics.lastBatchResult === 'transport_unavailable';
  const now = Date.now();
  const lastSuccessReport = lastSuccessReportByScope.get(scopeId) ?? 0;

  if (!isFailure && now - lastSuccessReport < SUCCESS_REPORT_INTERVAL_MS) {
    return;
  }

  if (!isFailure) {
    lastSuccessReportByScope.set(scopeId, now);
  }

  captureTelemetry('account_sync_snapshot', isFailure ? 'error' : 'info', {
    ...metrics,
  });
}
