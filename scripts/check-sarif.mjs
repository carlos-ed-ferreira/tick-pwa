import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function getRuleComponents(run) {
  const driverRules = run.tool?.driver?.rules ?? [];
  const extensions = run.tool?.extensions ?? [];

  if (
    !Array.isArray(driverRules) ||
    !Array.isArray(extensions) ||
    !Array.isArray(run.results)
  ) {
    throw new Error('Invalid SARIF run.');
  }

  return [driverRules, ...extensions.map((extension) => extension.rules ?? [])];
}

function findReferencedRule(result, components) {
  const reference = result.rule;
  const componentIndex = reference?.toolComponent?.index;
  const rules =
    componentIndex === undefined
      ? components[0]
      : components[componentIndex + 1];

  return rules?.[reference?.index ?? result.ruleIndex];
}

function findRule(result, components) {
  const ruleId = result.ruleId ?? result.rule?.id;

  return (
    findReferencedRule(result, components) ??
    components.flat().find((candidate) => candidate.id === ruleId)
  );
}

function assertSafeRule(rule) {
  if (!rule) throw new Error('SARIF result has no rule.');
  const rawSeverity = rule.properties?.['security-severity'];
  if (rawSeverity === undefined) return;
  const severity = Number(rawSeverity);
  if (!Number.isFinite(severity)) throw new Error('Invalid SARIF severity.');
  if (severity >= 7)
    throw new Error(`High or critical security finding: ${rule.id}`);
}

export function assertSafeSarif(report) {
  if (
    report.version !== '2.1.0' ||
    !Array.isArray(report.runs) ||
    report.runs.length === 0
  ) {
    throw new Error('Missing or malformed SARIF report.');
  }
  for (const run of report.runs) {
    const components = getRuleComponents(run);
    for (const result of run.results) {
      assertSafeRule(findRule(result, components));
    }
  }
}

function main(directory) {
  const files = readdirSync(directory).filter((filename) =>
    filename.endsWith('.sarif'),
  );
  if (files.length === 0) throw new Error('No SAST reports were generated.');
  for (const file of files)
    assertSafeSarif(
      JSON.parse(readFileSync(path.join(directory, file), 'utf8')),
    );
  console.log('No high or critical SAST findings.');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
