import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const archivePath = path.resolve(process.argv[2] ?? '');

if (!process.argv[2]) {
  throw new Error('Usage: node scripts/restore-backup.mjs <encrypted-archive>');
}

const containerName = `tick-backup-restore-${process.pid}`;
const password = randomBytes(24).toString('hex');
const restoreDirectory = mkdtempSync(path.join(tmpdir(), 'tick-restore-'));
const startedAt = Date.now();

try {
  runNode([
    'scripts/backup-archive.mjs',
    'decrypt',
    archivePath,
    restoreDirectory,
  ]);
  run('docker', [
    'run',
    '--detach',
    '--name',
    containerName,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'public.ecr.aws/supabase/postgres:17.6.1.121',
  ]);
  waitForPostgres();
  initializeAuthSchema();
  initializeStorageSchema();

  for (const fileName of ['roles.sql', 'schema.sql', 'data.sql']) {
    run(
      'docker',
      [
        'exec',
        '--interactive',
        containerName,
        'psql',
        '--set',
        'ON_ERROR_STOP=1',
        '--username',
        'postgres',
        '--dbname',
        'postgres',
      ],
      readFileSync(path.join(restoreDirectory, fileName)),
    );
  }

  const verification = run('docker', [
    'exec',
    containerName,
    'psql',
    '--tuples-only',
    '--no-align',
    '--username',
    'postgres',
    '--dbname',
    'postgres',
    '--command',
    "select count(*) from information_schema.tables where table_schema = 'public';",
  ]).trim();
  const completedAt = Date.now();
  const manifest = JSON.parse(
    readFileSync(path.join(restoreDirectory, 'manifest.json'), 'utf8'),
  );
  const backupCreatedAt = Date.parse(manifest.createdAt);

  if (!Number.isFinite(backupCreatedAt)) {
    throw new Error('Backup manifest has an invalid creation time.');
  }

  console.log(
    JSON.stringify(
      {
        publicTables: Number(verification),
        backupCreatedAt: manifest.createdAt,
        rpoMs: Math.max(startedAt - backupCreatedAt, 0),
        rtoMs: completedAt - startedAt,
      },
      null,
      2,
    ),
  );
} finally {
  spawnSync('docker', ['rm', '--force', `${containerName}-storage`], {
    encoding: 'utf8',
  });
  spawnSync('docker', ['rm', '--force', `${containerName}-auth`], {
    encoding: 'utf8',
  });
  spawnSync('docker', ['rm', '--force', '--volumes', containerName], {
    encoding: 'utf8',
  });
  rmSync(restoreDirectory, { force: true, recursive: true });
}

function runNode(args) {
  run(process.execPath, args);
}

function initializeAuthSchema() {
  run('docker', [
    'run',
    '--rm',
    '--name',
    `${containerName}-auth`,
    '--network',
    `container:${containerName}`,
    '--env',
    `GOTRUE_DB_DATABASE_URL=postgresql://supabase_auth_admin:${password}@127.0.0.1:5432/postgres`,
    '--env',
    'GOTRUE_DB_DRIVER=postgres',
    '--env',
    `GOTRUE_JWT_SECRET=${randomBytes(32).toString('hex')}`,
    '--env',
    'GOTRUE_SITE_URL=http://localhost',
    '--env',
    'API_EXTERNAL_URL=http://localhost',
    '--entrypoint',
    'auth',
    'public.ecr.aws/supabase/gotrue:v2.197.0',
    'migrate',
  ]);
}

function initializeStorageSchema() {
  run('docker', [
    'run',
    '--rm',
    '--name',
    `${containerName}-storage`,
    '--network',
    `container:${containerName}`,
    '--env',
    `DATABASE_URL=postgresql://supabase_storage_admin:${password}@127.0.0.1:5432/postgres`,
    '--env',
    `AUTH_JWT_SECRET=${randomBytes(32).toString('hex')}`,
    '--env',
    'STORAGE_BACKEND=file',
    '--env',
    'FILE_STORAGE_BACKEND_PATH=/tmp/storage',
    '--entrypoint',
    'node',
    'docker.io/supabase/storage-api:v1.81.0',
    'dist/scripts/migrate-call.js',
  ]);
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: input ? undefined : 'utf8',
    input,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? '';
    const stdout = result.stdout?.toString() ?? '';
    throw new Error(stderr || stdout || `${command} failed.`);
  }

  return result.stdout?.toString() ?? '';
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        containerName,
        'pg_isready',
        '--host',
        '127.0.0.1',
        '--username',
        'postgres',
      ],
      { encoding: 'utf8' },
    );

    if (result.status === 0) {
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  throw new Error('Isolated PostgreSQL did not become ready.');
}
