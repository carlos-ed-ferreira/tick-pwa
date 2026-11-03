import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { arch, cpus, platform, tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'node:net';
import { readBenchmarkOptions } from './benchmark-statistics.mjs';

const source = process.cwd();
const basePort = Number(process.env.TICK_BENCHMARK_BASE_PORT ?? 56320);
if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65000) {
  throw new Error('Invalid benchmark base port.');
}
readBenchmarkOptions(process.env, `http://127.0.0.1:${basePort + 1}`);
const directory = mkdtempSync(path.join(tmpdir(), 'tick-cohort-'));
const reportPath = path.join(source, '.next/benchmarks/cohort-latest.json');
const projectId = `tick-cohort-${process.pid}`;
let cleanupSucceeded = false;
rmSync(reportPath, { force: true });

async function make(target, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn('make', [target, ...args], {
      cwd: directory,
      env: {
        ...process.env,
        SUPABASE_ENV_FILE: path.join(directory, 'no-environment-file'),
        TICK_BENCHMARK_REPORT: reportPath,
      },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${target} failed (${code}).`)),
    );
  });
}

async function resourceSnapshot() {
  const container = `supabase_db_${projectId}`;
  async function capture(args) {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (data) => {
        output += data;
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Isolated resource snapshot failed.'));
          return;
        }
        try {
          resolve(JSON.parse(output));
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  const runtime = await capture([
    'stats',
    '--no-stream',
    '--format',
    '{{json .}}',
    container,
  ]);
  const database = await capture([
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atc',
    "select json_build_object('databaseBytes',pg_database_size(current_database()),'commits',xact_commit,'rollbacks',xact_rollback,'deadlocks',deadlocks,'tuplesReturned',tup_returned,'locks',(select count(*) from pg_locks)) from pg_stat_database where datname=current_database()",
  ]);
  return { runtime, database };
}

try {
  const listeners = [];
  try {
    for (let offset = 0; offset < 10; offset += 1) {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(basePort + offset, '127.0.0.1', resolve);
      });
      listeners.push(server);
    }
  } finally {
    await Promise.all(
      listeners.map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    );
  }
  for (const name of ['Makefile', 'package.json', 'scripts', 'supabase']) {
    cpSync(path.join(source, name), path.join(directory, name), {
      recursive: true,
      filter: (entry) => !path.basename(entry).startsWith('.'),
    });
  }
  symlinkSync(
    path.join(source, 'node_modules'),
    path.join(directory, 'node_modules'),
    'dir',
  );
  const configPath = path.join(directory, 'supabase/config.toml');
  const config = readFileSync(configPath, 'utf8')
    .replace(/^project_id = .*$/mu, `project_id = "${projectId}"`)
    .replace(/\b5432(\d)\b/gu, (_, offset) =>
      String(basePort + Number(offset)),
    );
  writeFileSync(configPath, config);
  console.log(`Isolated project ${projectId}; report ${reportPath}`);
  await make('supabase-start-account');
  await make('supabase-reset');
  await make('supabase-lint');
  await make('supabase-diff-check');
  await make('supabase-test-db');
  rmSync(reportPath, { force: true });
  const before = await resourceSnapshot();
  await make('benchmark-cohort-run');
  const after = await resourceSnapshot();
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  report.host = {
    architecture: arch(),
    platform: platform(),
    logicalCpus: cpus().length,
  };
  report.resources = { before, after };
  report.correctnessChecksPassed = true;
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
} finally {
  if (
    existsSync(path.join(directory, 'supabase/config.toml')) &&
    readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8').includes(
      projectId,
    )
  ) {
    try {
      await make('supabase-stop', ['args=--no-backup']);
      cleanupSucceeded = true;
    } finally {
      if (!cleanupSucceeded) {
        console.error(
          `Cleanup requires attention: isolated checkout retained at ${directory}`,
        );
      }
    }
  } else {
    cleanupSucceeded = true;
  }
  if (cleanupSucceeded) {
    rmSync(directory, { recursive: true, force: true });
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      report.cleanupCompleted = true;
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
  }
}
