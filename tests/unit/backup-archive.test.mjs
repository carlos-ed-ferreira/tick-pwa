import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('backup archive', () => {
  it('encrypts and authenticates the complete logical backup', () => {
    const root = createTemporaryDirectory();
    const source = path.join(root, 'source');
    const restored = path.join(root, 'restored');
    const archive = path.join(root, 'backup.enc');
    mkdirSync(source);

    const files = {
      'data.sql': 'insert into example values (1);',
      'manifest.json': JSON.stringify({
        createdAt: '2026-08-31T15:00:00.000Z',
        version: 1,
      }),
      'roles.sql': 'create role example;',
      'schema.sql': 'create table example (id integer);',
    };

    for (const [fileName, contents] of Object.entries(files)) {
      writeFileSync(path.join(source, fileName), contents);
    }

    expect(runArchive('encrypt', source, archive, 'a'.repeat(32)).status).toBe(
      0,
    );
    expect(
      runArchive('decrypt', archive, restored, 'a'.repeat(32)).status,
    ).toBe(0);

    for (const [fileName, contents] of Object.entries(files)) {
      expect(readFileSync(path.join(restored, fileName), 'utf8')).toBe(
        contents,
      );
    }

    const rejected = runArchive(
      'decrypt',
      archive,
      path.join(root, 'rejected'),
      'b'.repeat(32),
    );
    expect(rejected.status).not.toBe(0);
  });
});

function createTemporaryDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'tick-backup-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function runArchive(command, source, target, secret) {
  return spawnSync(
    process.execPath,
    ['scripts/backup-archive.mjs', command, source, target],
    {
      encoding: 'utf8',
      env: { ...process.env, TICK_BACKUP_ENCRYPTION_KEY: secret },
    },
  );
}
