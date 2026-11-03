import { describe, expect, it } from 'vitest';
import {
  readBenchmarkOptions,
  findBenchmarkRegressions,
  summarizeMeasurements,
} from '../../scripts/benchmark-statistics.mjs';

describe('capacity benchmark contracts', () => {
  it('rejects incomparable workloads and detects p95 and pull regressions above ten percent', () => {
    const baseline = {
      options: {
        concurrency: 4,
        iterations: 30,
        fixtureRows: 5000,
        timeoutMs: 10000,
      },
      firstPull: { rows: 5000, durationMs: 100 },
      runs: [{ batchSize: 1, p95Ms: 100, errors: 0 }],
    };
    const current = structuredClone(baseline);
    expect(findBenchmarkRegressions(current, baseline)).toEqual([]);
    current.runs[0].p95Ms = 111;
    current.firstPull.durationMs = 120;
    expect(findBenchmarkRegressions(current, baseline)).toEqual([
      'batch-1-p95',
      'first-pull',
    ]);
    current.options.concurrency = 8;
    expect(() => findBenchmarkRegressions(current, baseline)).toThrow(
      /workload/i,
    );
  });
  it('uses bounded defaults and accepts only a loopback API without credentials', () => {
    expect(readBenchmarkOptions({}, 'http://127.0.0.1:56321')).toEqual({
      iterations: 30,
      concurrency: 4,
      timeoutMs: 10000,
      fixtureRows: 5000,
    });
    for (const url of [
      'https://project.supabase.co',
      'http://127.0.0.1.attacker.test:56321',
      'http://localhost:56321@attacker.test',
      'http://user:pass@localhost:56321',
    ]) {
      expect(() => readBenchmarkOptions({}, url)).toThrow();
    }
  });

  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', '33'])(
    'rejects unsafe concurrency %s',
    (value) => {
      expect(() =>
        readBenchmarkOptions(
          { TICK_BENCHMARK_CONCURRENCY: value },
          'http://localhost:56321',
        ),
      ).toThrow(/concurrency/i);
    },
  );

  it('reports nearest-rank percentiles for successful requests separately from errors', () => {
    expect(summarizeMeasurements([50, 10, 30, 20, 40], 2, 1000)).toEqual({
      successes: 5,
      errors: 2,
      errorRate: 2 / 7,
      p50Ms: 30,
      p95Ms: 50,
      p99Ms: 50,
      throughputPerSecond: 5,
    });
  });

  it('does not report failed requests as latency or throughput successes', () => {
    expect(summarizeMeasurements([], 3, 2000)).toMatchObject({
      successes: 0,
      errors: 3,
      errorRate: 1,
      p95Ms: null,
      throughputPerSecond: 0,
    });
  });
});
