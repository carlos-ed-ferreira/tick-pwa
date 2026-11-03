import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execute = promisify(execFile);
const reportDirectory = mkdtempSync(path.join(tmpdir(), 'tick-secret-scan-'));
const argumentsList = [
  'run',
  '--rm',
  '--volume',
  `${process.cwd()}:/repo:ro`,
  '--volume',
  `${reportDirectory}:/report`,
  '--env',
  'GIT_CONFIG_COUNT=1',
  '--env',
  'GIT_CONFIG_KEY_0=safe.directory',
  '--env',
  'GIT_CONFIG_VALUE_0=/repo',
  'zricethezav/gitleaks:v8.30.1',
  'git',
  '/repo',
  '--redact=100',
  '--no-banner',
  '--report-format',
  'json',
  '--report-path',
  '/report/findings.json',
  '--gitleaks-ignore-path',
  '/repo/.gitleaksignore',
];

try {
  await execute('docker', argumentsList, { maxBuffer: 10 * 1024 * 1024 });
  console.log('No committed secrets found.');
} catch (error) {
  if (error.code !== 1) {
    console.error(
      'Secret scanner could not complete. Check Docker and registry availability.',
    );
  } else {
    try {
      const findings = JSON.parse(
        readFileSync(path.join(reportDirectory, 'findings.json'), 'utf8'),
      );
      for (const finding of findings) {
        console.error(
          JSON.stringify({
            rule: finding.RuleID,
            file: finding.File,
            line: finding.StartLine,
            fingerprint: finding.Fingerprint,
          }),
        );
      }
    } catch {
      console.error(
        'Secret scanner produced an invalid report. Raw content was withheld.',
      );
    }
  }
  process.exitCode = 1;
}

rmSync(reportDirectory, { recursive: true, force: true });
