export function findBenchmarkRegressions(current, baseline) {
  if (
    ['concurrency', 'iterations', 'fixtureRows', 'timeoutMs'].some(
      (key) => current.options[key] !== baseline.options[key],
    ) ||
    current.firstPull.rows !== baseline.firstPull.rows ||
    current.runs.length !== baseline.runs.length
  ) {
    throw new Error('Benchmark workload differs from the baseline.');
  }
  const regressions = [];
  for (const run of current.runs) {
    const previous = baseline.runs.find(
      (entry) => entry.batchSize === run.batchSize,
    );
    if (
      !previous ||
      !Number.isFinite(previous.p95Ms) ||
      !Number.isFinite(run.p95Ms)
    ) {
      throw new Error('Benchmark workload has incomplete latency data.');
    }
    if (run.errors || run.p95Ms > previous.p95Ms * 1.1) {
      regressions.push(`batch-${run.batchSize}-p95`);
    }
  }
  if (current.firstPull.durationMs > baseline.firstPull.durationMs * 1.1) {
    regressions.push('first-pull');
  }
  return regressions;
}

export function readBenchmarkOptions(environment, address) {
  const url = new URL(address);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('The account benchmark only runs against local Supabase.');
  }
  const options = {};
  for (const [name, key, fallback, maximum] of [
    ['iterations', 'ITERATIONS', 30, 1000],
    ['concurrency', 'CONCURRENCY', 4, 32],
    ['timeoutMs', 'TIMEOUT_MS', 10000, 60000],
    ['fixtureRows', 'FIXTURE_ROWS', 5000, 10000],
  ]) {
    const value = Number(environment[`TICK_BENCHMARK_${key}`] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > maximum) {
      throw new Error(`Invalid benchmark ${name}: expected 1..${maximum}.`);
    }
    options[name] = value;
  }
  return options;
}

export function summarizeMeasurements(durations, errors, elapsedMs) {
  const sorted = [...durations].sort((first, second) => first - second);
  const percentile = (ratio) =>
    sorted.length ? sorted[Math.ceil(sorted.length * ratio) - 1] : null;
  const total = sorted.length + errors;
  return {
    successes: sorted.length,
    errors,
    errorRate: total ? errors / total : 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    throughputPerSecond: elapsedMs > 0 ? (sorted.length * 1000) / elapsedMs : 0,
  };
}
