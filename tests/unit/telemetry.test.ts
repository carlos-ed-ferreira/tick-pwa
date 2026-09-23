import { describe, expect, it, vi } from 'vitest';
import { createSentryAdapter } from '@/lib/telemetry/browser';
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

describe('sentry adapter', () => {
  function captureSignal(event: TelemetryEvent): Record<string, unknown> {
    const captured: Record<string, unknown>[] = [];

    createSentryAdapter((sentryEvent) => {
      captured.push(sentryEvent);

      return 'event-id';
    }).capture(event);

    return captured[0];
  }

  it('groups each telemetry signal as its own issue', () => {
    const accumulated = captureSignal({
      attributes: { queuedOperations: 30 },
      level: 'info',
      name: 'account_sync_snapshot',
    });
    const unavailable = captureSignal({
      attributes: { lastBatchResult: 'transport_unavailable' },
      level: 'error',
      name: 'account_sync_snapshot',
    });
    const healthy = captureSignal({
      attributes: { queuedOperations: 1 },
      level: 'info',
      name: 'account_sync_snapshot',
    });

    expect(accumulated.fingerprint).toEqual([
      'tick',
      'account_sync_snapshot',
      'queue_accumulated',
    ]);
    expect(unavailable.fingerprint).toEqual([
      'tick',
      'account_sync_snapshot',
      'api_unavailable',
    ]);
    expect(healthy.fingerprint).toEqual([
      'tick',
      'account_sync_snapshot',
      'healthy',
    ]);
  });

  it('keeps the signal tag and the searchable message', () => {
    const synthetic = captureSignal({
      attributes: { signal: 'manual_validation' },
      level: 'error',
      name: 'synthetic_failure',
    });

    expect(synthetic.message).toBe('tick.synthetic_failure');
    expect(synthetic.tags).toMatchObject({
      telemetry_event: 'synthetic_failure',
      telemetry_signal: 'synthetic_failure',
    });
  });
});
