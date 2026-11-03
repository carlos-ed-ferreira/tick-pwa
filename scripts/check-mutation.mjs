import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const baselinePath = 'docs/operations/baselines/mutation.json';

export function mutationScores(report) {
  const counts = Object.entries(report.files).map(([filename, file]) => {
    const valid = file.mutants.filter(
      (mutant) =>
        !['CompileError', 'RuntimeError', 'Ignored'].includes(mutant.status),
    );
    const detected = valid.filter((mutant) =>
      ['Killed', 'Timeout'].includes(mutant.status),
    ).length;
    return { filename, total: valid.length, detected };
  });
  if (!counts.length || counts.some((file) => !file.total))
    throw new Error('Mutation report has no valid mutants.');
  const score = (detected, total) =>
    Math.floor((detected / total) * 10000) / 100;
  return {
    total: score(
      counts.reduce((sum, file) => sum + file.detected, 0),
      counts.reduce((sum, file) => sum + file.total, 0),
    ),
    files: Object.fromEntries(
      counts.map((file) => [file.filename, score(file.detected, file.total)]),
    ),
  };
}

function main() {
  const current = mutationScores(
    JSON.parse(readFileSync('coverage/mutation/mutation.json', 'utf8')),
  );
  if (process.argv[2] === '--write-baseline') {
    current.metadata = {
      measuredAt: new Date().toISOString(),
      tool: 'Stryker',
      version: JSON.parse(readFileSync('package.json', 'utf8')).devDependencies[
        '@stryker-mutator/core'
      ],
      scope: 'stryker.config.json mutate list',
    };
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    return;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (current.total < Math.max(70, baseline.total))
    throw new Error('Global mutation score regressed.');
  for (const [filename, minimum] of Object.entries(baseline.files)) {
    if (
      current.files[filename] === undefined ||
      current.files[filename] < Math.max(70, minimum)
    ) {
      throw new Error(`Mutation score regressed: ${filename}`);
    }
  }
  console.log(`Mutation ratchet passed: ${current.total}%.`);
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
