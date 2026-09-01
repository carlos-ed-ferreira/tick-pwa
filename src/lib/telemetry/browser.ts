import type { TelemetryAdapter, TelemetryEvent } from './client';
import { createTelemetryClient } from './client';

type CaptureTelemetry = ReturnType<typeof createTelemetryClient>['capture'];

let captureEvent: CaptureTelemetry | null = null;
let configuration: Promise<void> | null = null;
let syntheticFailureReported = false;

function getBrowserContext(): {
  browserName: string | null;
  browserVersion: string | null;
} {
  if (typeof navigator === 'undefined') {
    return { browserName: null, browserVersion: null };
  }

  const userAgent = navigator.userAgent;
  const match = userAgent.match(
    /(Edg|OPR|Chrome|CriOS|Firefox|FxiOS|Version)\/([\d.]+)/u,
  );

  if (!match) {
    return { browserName: 'Other', browserVersion: null };
  }

  const names: Record<string, string> = {
    Chrome: 'Chrome',
    CriOS: 'Chrome',
    Edg: 'Edge',
    Firefox: 'Firefox',
    FxiOS: 'Firefox',
    OPR: 'Opera',
    Version: /Safari/u.test(userAgent) ? 'Safari' : 'Other',
  };

  return {
    browserName: names[match[1]] ?? 'Other',
    browserVersion: match[2].split('.').at(0) ?? null,
  };
}

function createSentryAdapter(
  sentryCaptureEvent: (event: Record<string, unknown>) => string,
): TelemetryAdapter {
  return {
    capture(event) {
      sentryCaptureEvent({
        contexts: { tick: event.attributes },
        fingerprint: [`tick.${event.name}`],
        level: event.level,
        message: `tick.${event.name}`,
        tags: {
          telemetry_event: event.name,
          telemetry_result:
            typeof event.attributes.result === 'string'
              ? event.attributes.result
              : typeof event.attributes.lastBatchResult === 'string'
                ? event.attributes.lastBatchResult
                : 'none',
          telemetry_signal: getTelemetrySignal(event),
        },
      });
    },
  };
}

function getTelemetrySignal(event: TelemetryEvent): string {
  if (event.name === 'synthetic_failure') {
    return 'synthetic_failure';
  }

  if (event.attributes.lastBatchResult === 'transport_unavailable') {
    return 'api_unavailable';
  }

  if (
    typeof event.attributes.oldestOperationAgeMs === 'number' &&
    event.attributes.oldestOperationAgeMs >= 300_000
  ) {
    return 'old_operation';
  }

  if (
    typeof event.attributes.queuedOperations === 'number' &&
    event.attributes.queuedOperations >= 25
  ) {
    return 'queue_accumulated';
  }

  if (event.level === 'error') {
    return 'sync_failure';
  }

  return 'healthy';
}

export function configureBrowserTelemetry(): Promise<void> {
  if (configuration) {
    return configuration;
  }

  configuration = (async () => {
    const dsn = process.env.NEXT_PUBLIC_TICK_TELEMETRY_DSN?.trim();

    if (!dsn || typeof window === 'undefined') {
      return;
    }

    const sentry = await import('@sentry/browser');
    sentry.init({
      defaultIntegrations: false,
      dsn,
      environment:
        process.env.NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT ?? 'production',
      integrations: [],
      release: process.env.NEXT_PUBLIC_TICK_RELEASE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });

    const client = createTelemetryClient(
      createSentryAdapter(sentry.captureEvent),
      {
        appVersion: process.env.NEXT_PUBLIC_TICK_RELEASE ?? null,
        ...getBrowserContext(),
        environment:
          process.env.NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT ?? 'production',
      },
    );
    captureEvent = client.capture;
  })().catch(() => {
    console.error('Failed to initialize Tick telemetry.');
  });

  return configuration;
}

export function captureTelemetry(
  ...parameters: Parameters<ReturnType<typeof createTelemetryClient>['capture']>
): void {
  captureEvent?.(...parameters);
}

export function reportSyntheticTelemetryFailure(): void {
  if (
    process.env.NEXT_PUBLIC_TICK_TELEMETRY_SYNTHETIC_FAILURE !== '1' ||
    typeof window === 'undefined'
  ) {
    return;
  }

  if (syntheticFailureReported) {
    return;
  }

  syntheticFailureReported = true;
  captureTelemetry('synthetic_failure', 'error', {
    signal: 'manual_validation',
  });
}
