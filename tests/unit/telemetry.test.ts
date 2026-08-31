import { describe, expect, it, vi } from 'vitest';
import {
  createTelemetryClient,
  type TelemetryAdapter,
  type TelemetryEvent,
} from '@/lib/telemetry/client';

describe('telemetry client', () => {
  it('sends only allowlisted aggregate fields', () => {
    const capture = vi.fn();
    const adapter: TelemetryAdapter = { capture };
    const client = createTelemetryClient(adapter, {
      appVersion: 'release-1',
      browserName: 'Chromium',
      browserVersion: '140',
      environment: 'production',
    });

    client.capture('account_sync_snapshot', 'error', {
      batchesRejected: 2,
      maxAttempts: 5,
      oldestOperationAgeMs: 90_000,
      queuedOperations: 4,
      task: 'private task',
      email: 'private@example.com',
      token: 'private-token',
      payload: { name: 'private category' },
    });

    expect(capture).toHaveBeenCalledWith({
      attributes: {
        appVersion: 'release-1',
        batchesRejected: 2,
        browserName: 'Chromium',
        browserVersion: '140',
        environment: 'production',
        maxAttempts: 5,
        oldestOperationAgeMs: 90_000,
        queuedOperations: 4,
      },
      level: 'error',
      name: 'account_sync_snapshot',
    } satisfies TelemetryEvent);
    expect(JSON.stringify(capture.mock.calls)).not.toContain('private');
  });

  it('drops unsupported fields and invalid scalar values', () => {
    const capture = vi.fn();
    const client = createTelemetryClient(
      { capture },
      {
        appVersion: null,
        browserName: null,
        browserVersion: null,
        environment: null,
      },
    );

    client.capture('account_refresh', 'info', {
      durationMs: Number.NaN,
      reason: 'online',
      result: 'completed',
      totalPages: 3,
      totalRows: 20,
      userId: 'user-id',
    });

    expect(capture).toHaveBeenCalledWith({
      attributes: {
        reason: 'online',
        result: 'completed',
        totalPages: 3,
        totalRows: 20,
      },
      level: 'info',
      name: 'account_refresh',
    });
  });
});
