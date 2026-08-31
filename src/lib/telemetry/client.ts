export type TelemetryEventName =
  | 'account_refresh'
  | 'account_sync_snapshot'
  | 'synthetic_failure';

export type TelemetryLevel = 'error' | 'info' | 'warning';
export type TelemetryScalar = boolean | number | string;

export interface TelemetryEvent {
  attributes: Record<string, TelemetryScalar>;
  level: TelemetryLevel;
  name: TelemetryEventName;
}

export interface TelemetryAdapter {
  capture(event: TelemetryEvent): Promise<void> | void;
}

interface TelemetryRuntimeContext {
  appVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  environment: string | null;
}

const commonFields = [
  'appVersion',
  'browserName',
  'browserVersion',
  'environment',
] as const;

const allowedFields: Record<TelemetryEventName, readonly string[]> = {
  account_refresh: [
    ...commonFields,
    'durationMs',
    'reason',
    'result',
    'totalPages',
    'totalRows',
  ],
  account_sync_snapshot: [
    ...commonFields,
    'batchesConfirmed',
    'batchesRejected',
    'batchesSent',
    'conflicts',
    'definitiveFailures',
    'lastBatchDurationMs',
    'lastBatchMutationCount',
    'lastBatchResult',
    'lastConfirmationLatencyMs',
    'lastErrorCode',
    'maxAttempts',
    'maxBatchDurationMs',
    'maxBatchMutationCount',
    'maxConfirmationLatencyMs',
    'oldestOperationAgeMs',
    'queuedMutations',
    'queuedOperations',
    'transportFailures',
  ],
  synthetic_failure: [...commonFields, 'signal'],
};

function isTelemetryScalar(value: unknown): value is TelemetryScalar {
  return (
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function sanitizeAttributes(
  name: TelemetryEventName,
  attributes: Record<string, unknown>,
): Record<string, TelemetryScalar> {
  const sanitized: Record<string, TelemetryScalar> = {};

  for (const field of allowedFields[name]) {
    const value = attributes[field];

    if (isTelemetryScalar(value)) {
      sanitized[field] = value;
    }
  }

  return sanitized;
}

export function createTelemetryClient(
  adapter: TelemetryAdapter,
  runtimeContext: TelemetryRuntimeContext,
): {
  capture: (
    name: TelemetryEventName,
    level: TelemetryLevel,
    attributes: Record<string, unknown>,
  ) => void;
} {
  return {
    capture(name, level, attributes) {
      const event: TelemetryEvent = {
        attributes: sanitizeAttributes(name, {
          ...attributes,
          ...runtimeContext,
        }),
        level,
        name,
      };

      void Promise.resolve(adapter.capture(event)).catch(() => {
        console.error('Failed to send Tick telemetry.');
      });
    },
  };
}
