import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => {
  const spawnSync = vi.fn();
  return { spawnSync, default: { spawnSync } };
});

const originalArgv = process.argv;

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.resetModules();
});

it('aborts and removes the temporary volume when only the temporary server is ready', async () => {
  vi.spyOn(Atomics, 'wait').mockReturnValue('timed-out');
  process.argv = [process.execPath, 'scripts/restore-backup.mjs', 'backup.enc'];
  vi.mocked(spawnSync).mockImplementation((command, args) => ({
    status: args.includes('pg_isready') && args.includes('--host') ? 1 : 0,
    stdout: '',
    stderr: '',
  }));

  await expect(import('../../scripts/restore-backup.mjs')).rejects.toThrow(
    'Isolated PostgreSQL did not become ready.',
  );

  expect(
    spawnSync.mock.calls.filter(([, args]) => args.includes('pg_isready')),
  ).toHaveLength(30);
  expect(spawnSync.mock.calls.some(([, args]) => args.includes('psql'))).toBe(
    false,
  );
  expect(spawnSync).toHaveBeenLastCalledWith(
    'docker',
    [
      'rm',
      '--force',
      '--volumes',
      expect.stringMatching(/^tick-backup-restore-/),
    ],
    { encoding: 'utf8' },
  );
});

it('waits for the final TCP server before restoring into the container', async () => {
  let tcpReady = false;
  let tcpChecks = 0;
  const restoredFiles = [];
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(Atomics, 'wait').mockReturnValue('timed-out');
  process.argv = [process.execPath, 'scripts/restore-backup.mjs', 'backup.enc'];
  vi.mocked(spawnSync).mockImplementation((command, args, options) => {
    if (command === process.execPath) {
      const directory = args[3];
      for (const file of ['roles.sql', 'schema.sql', 'data.sql']) {
        writeFileSync(path.join(directory, file), file);
      }
      writeFileSync(
        path.join(directory, 'manifest.json'),
        JSON.stringify({ createdAt: '2026-11-02T20:35:00.000Z' }),
      );
    }
    if (args.includes('pg_isready') && args.includes('--host')) {
      expect(args[args.indexOf('--host') + 1]).toBe('127.0.0.1');
      tcpChecks += 1;
      tcpReady = tcpChecks > 1;
      return { status: tcpReady ? 0 : 1, stdout: '', stderr: '' };
    }
    if (args.includes('psql') && options?.input) {
      if (!tcpReady) {
        return {
          status: 1,
          stderr:
            'duplicate key value violates unique constraint "pg_extension_name_index"',
        };
      }
      restoredFiles.push(options.input.toString());
    }
    return {
      status: 0,
      stdout: args.includes('--command') ? '12\n' : '',
      stderr: '',
    };
  });

  await import('../../scripts/restore-backup.mjs');

  expect(tcpChecks).toBe(2);
  const bootstrapIndex = spawnSync.mock.calls.findIndex(([, args]) =>
    args.includes('migrate'),
  );
  const firstRestoreIndex = spawnSync.mock.calls.findIndex(
    ([, , options]) => options?.input,
  );
  expect(bootstrapIndex).toBeGreaterThan(0);
  expect(bootstrapIndex).toBeLessThan(firstRestoreIndex);
  const storageIndex = spawnSync.mock.calls.findIndex(([, args]) =>
    args.includes('dist/scripts/migrate-call.js'),
  );
  expect(storageIndex).toBeGreaterThan(bootstrapIndex);
  expect(storageIndex).toBeLessThan(firstRestoreIndex);
  expect(spawnSync.mock.calls[storageIndex][1]).toContainEqual(
    expect.stringMatching(
      /^DATABASE_URL=postgresql:\/\/supabase_storage_admin:.*@127\.0\.0\.1:5432\/postgres$/,
    ),
  );
  expect(spawnSync.mock.calls[bootstrapIndex][1]).toContainEqual(
    expect.stringMatching(
      /^GOTRUE_DB_DATABASE_URL=postgresql:\/\/supabase_auth_admin:.*@127\.0\.0\.1:5432\/postgres$/,
    ),
  );
  expect(restoredFiles).toEqual(['roles.sql', 'schema.sql', 'data.sql']);
  expect(JSON.parse(log.mock.calls[0][0]).publicTables).toBe(12);
  expect(spawnSync).toHaveBeenLastCalledWith(
    'docker',
    [
      'rm',
      '--force',
      '--volumes',
      expect.stringMatching(/^tick-backup-restore-/),
    ],
    { encoding: 'utf8' },
  );
});
