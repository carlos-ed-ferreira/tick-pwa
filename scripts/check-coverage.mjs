import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const baselinePath = 'docs/operations/baselines/coverage.json';
const percentage = (covered, total) => (total ? (covered / total) * 100 : 100);

export function compareCoverage(current, minimum) {
  return ['lines', 'branches']
    .filter((metric) => current[metric] + 0.000001 < minimum[metric])
    .map(
      (metric) => `${metric}: ${current[metric]} is below ${minimum[metric]}`,
    );
}

export function changedCoverage(file, lines) {
  const statements = new Map();
  for (const [id, location] of Object.entries(file.statementMap)) {
    if (lines.has(location.start.line))
      statements.set(
        location.start.line,
        (statements.get(location.start.line) ?? false) || file.s[id] > 0,
      );
  }
  let coveredBranches = 0;
  let totalBranches = 0;
  for (const [id, branch] of Object.entries(file.branchMap)) {
    if (
      !lines.has(branch.line) &&
      !branch.locations.some((location) => lines.has(location.start.line))
    )
      continue;
    totalBranches += file.b[id].length;
    coveredBranches += file.b[id].filter((count) => count > 0).length;
  }
  return {
    coveredLines: [...statements.values()].filter(Boolean).length,
    totalLines: statements.size,
    coveredBranches,
    totalBranches,
  };
}

function changedLines(filename, baseRef) {
  const tracked = execFileSync('git', ['ls-files', '--', filename], {
    encoding: 'utf8',
  }).trim();
  if (!tracked)
    return new Set(
      readFileSync(filename, 'utf8')
        .split('\n')
        .map((_, index) => index + 1),
    );
  const diff = execFileSync(
    'git',
    ['diff', '--no-ext-diff', '--unified=0', baseRef, '--', filename],
    { encoding: 'utf8' },
  );
  const lines = new Set();
  for (const match of diff.matchAll(/^@@ .*?\+(\d+)(?:,(\d+))? @@/gmu)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let offset = 0; offset < count; offset += 1) lines.add(start + offset);
  }
  return lines;
}

function diffCoverage(coverage) {
  const totals = {
    coveredLines: 0,
    totalLines: 0,
    coveredBranches: 0,
    totalBranches: 0,
  };
  const baseRef = process.env.COVERAGE_BASE_REF || 'HEAD';
  for (const [filename, file] of Object.entries(coverage)) {
    const relative = path.relative(process.cwd(), filename);
    if (!relative.startsWith('src/')) continue;
    const counts = changedCoverage(file, changedLines(relative, baseRef));
    for (const metric of Object.keys(totals)) totals[metric] += counts[metric];
  }
  return {
    lines: percentage(totals.coveredLines, totals.totalLines),
    branches: percentage(totals.coveredBranches, totals.totalBranches),
  };
}

function main() {
  const summary = JSON.parse(
    readFileSync('coverage/coverage-summary.json', 'utf8'),
  ).total;
  const current = { lines: summary.lines.pct, branches: summary.branches.pct };
  if (process.argv[2] === '--write-baseline') {
    const metadata = {
      measuredAt: new Date().toISOString(),
      tool: 'Vitest V8',
      version: JSON.parse(readFileSync('package.json', 'utf8')).devDependencies[
        '@vitest/coverage-v8'
      ],
      scope: 'src TS/TSX except database.types.ts and src/app/sw.ts',
    };
    writeFileSync(
      baselinePath,
      `${JSON.stringify({ minimum: current, goals: { lines: 80, branches: 70 }, diff: { lines: 90, branches: 80 }, metadata }, null, 2)}\n`,
    );
    console.log('Coverage baseline written for review.');
    return;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const diff = diffCoverage(
    JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8')),
  );
  const failures = [
    ...compareCoverage(current, baseline.minimum),
    ...compareCoverage(diff, baseline.diff).map((failure) => `diff ${failure}`),
  ];
  console.log(JSON.stringify({ global: current, diff }));
  if (failures.length) throw new Error(failures.join('\n'));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
