import { readFileSync } from 'node:fs';
import process from 'node:process';
import { findBenchmarkRegressions } from './benchmark-statistics.mjs';

const baselinePath = process.env.TICK_BENCHMARK_BASELINE;
if (!baselinePath)
  throw new Error('Set TICK_BENCHMARK_BASELINE to a comparable report.');
const current = JSON.parse(
  readFileSync('.next/benchmarks/cohort-latest.json', 'utf8'),
);
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
if (
  !current.correctnessChecksPassed ||
  !baseline.correctnessChecksPassed ||
  !current.cleanupCompleted ||
  !baseline.cleanupCompleted
) {
  throw new Error('Only complete isolated benchmark reports can be compared.');
}
const regressions = findBenchmarkRegressions(current, baseline);
console.log(JSON.stringify({ threshold: 0.1, regressions }, null, 2));
if (regressions.length) process.exitCode = 1;
