import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { executeNpmCi, installCi } from '../../scripts/install-ci.mjs';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn, default: { spawn } }));

function downloadFailure(detail) {
  return Object.assign(new Error('npm ci failed'), {
    exitCode: 1,
    installOutput: [
      'npm error path /home/runner/work/tick/node_modules/supabase',
      'npm error command sh -c node scripts/postinstall.js',
      'npm error Downloading https://github.com/supabase/cli/releases/download/v2.98.2/supabase_linux_amd64.tar.gz',
      `npm error ${detail}`,
    ].join('\n'),
  });
}

describe('CI installation recovery', () => {
  it('applies recovery through the shared Makefile target used by all workflows', () => {
    const makefile = readFileSync('Makefile', 'utf8');
    const installation = makefile.slice(
      makefile.indexOf('install-ci: require-npm'),
      makefile.indexOf('add-dependency: require-npm'),
    );
    expect(installation).toContain('node scripts/install-ci.mjs "$(NPM)"');
  });

  it('installs once without waiting when the first attempt succeeds', async () => {
    const execute = vi.fn();
    const wait = vi.fn();
    await installCi({ execute, wait, write: vi.fn() });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it.each([
    'Could not fetch checksum file 504 Gateway Time-out',
    '502 Bad Gateway',
    '503 Service Unavailable',
    '500 Internal Server Error',
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'Error: incorrect header check',
    'Z_DATA_ERROR',
    'unexpected end of file',
  ])(
    'reinstalls after a transient Supabase download failure: %s',
    async (detail) => {
      const execute = vi
        .fn()
        .mockRejectedValueOnce(downloadFailure(detail))
        .mockResolvedValueOnce();
      const wait = vi.fn();
      const write = vi.fn();
      await installCi({ execute, wait, write });
      expect(execute).toHaveBeenCalledTimes(2);
      expect(wait).toHaveBeenCalledExactlyOnceWith(5000);
      expect(write).toHaveBeenCalledWith(expect.stringContaining('2/3'));
    },
  );

  it('stops after three attempts and propagates the last failure', async () => {
    const first = downloadFailure('504 Gateway Time-out');
    const last = downloadFailure('Error: incorrect header check');
    const execute = vi
      .fn()
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(last);
    const wait = vi.fn();
    await expect(installCi({ execute, wait, write: vi.fn() })).rejects.toBe(
      last,
    );
    expect(execute).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[5000], [10000]]);
  });

  it.each([
    'Checksum mismatch. Downloaded data might be corrupted.',
    'EINTEGRITY',
    'EACCES',
    'EPERM',
    '404 Not Found',
    '403 Forbidden',
    '401 Unauthorized',
    'Installation is not supported',
    'Unknown installation failure',
  ])(
    'does not retry permanent or unknown installation failures: %s',
    async (detail) => {
      const error = downloadFailure(detail);
      const execute = vi.fn().mockRejectedValue(error);
      const wait = vi.fn();
      await expect(installCi({ execute, wait, write: vi.fn() })).rejects.toBe(
        error,
      );
      expect(execute).toHaveBeenCalledTimes(1);
      expect(wait).not.toHaveBeenCalled();
    },
  );

  it('does not retry an unrelated package failure or invalid lockfile', async () => {
    for (const installOutput of [
      'npm error code EUSAGE\nnpm error package-lock.json is not in sync',
      downloadFailure('504 Gateway Time-out').installOutput.replace(
        'node_modules/supabase',
        'node_modules/other',
      ),
      downloadFailure('504 Gateway Time-out').installOutput.replace(
        'github.com/supabase/cli',
        'example.com/other/cli',
      ),
    ]) {
      const error = Object.assign(new Error('failed'), { installOutput });
      const execute = vi.fn().mockRejectedValue(error);
      await expect(
        installCi({ execute, wait: vi.fn(), write: vi.fn() }),
      ).rejects.toBe(error);
      expect(execute).toHaveBeenCalledTimes(1);
    }
  });

  it('stops immediately if a permanent failure follows a transient failure', async () => {
    const permanent = downloadFailure(
      'Checksum mismatch. 504 Gateway Time-out',
    );
    const execute = vi
      .fn()
      .mockRejectedValueOnce(downloadFailure('504 Gateway Time-out'))
      .mockRejectedValueOnce(permanent);
    await expect(
      installCi({ execute, wait: vi.fn(), write: vi.fn() }),
    ).rejects.toBe(permanent);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry an interrupted process', async () => {
    const error = Object.assign(downloadFailure('504 Gateway Time-out'), {
      signal: 'SIGTERM',
    });
    const execute = vi.fn().mockRejectedValue(error);
    await expect(
      installCi({ execute, wait: vi.fn(), write: vi.fn() }),
    ).rejects.toBe(error);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe('npm installation process', () => {
  function childProcess() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawn.mockReturnValueOnce(child);
    return child;
  }

  it('runs npm ci and preserves both output streams for failure classification', async () => {
    const child = childProcess();
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const installation = executeNpmCi('/custom/npm');
      child.stdout.emit('data', Buffer.from('stdout fixture\n'));
      child.stderr.emit('data', Buffer.from('stderr fixture\n'));
      child.emit('close', 2, null);
      await expect(installation).rejects.toMatchObject({
        exitCode: 2,
        signal: null,
        installOutput: 'stdout fixture\nstderr fixture\n',
      });
      expect(spawn).toHaveBeenLastCalledWith('/custom/npm', ['ci'], {
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      expect(stdout).toHaveBeenCalledWith(Buffer.from('stdout fixture\n'));
      expect(stderr).toHaveBeenCalledWith(Buffer.from('stderr fixture\n'));
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it('resolves only after a successful process exit', async () => {
    const child = childProcess();
    const installation = executeNpmCi('npm');
    child.emit('close', 0, null);
    await expect(installation).resolves.toBeUndefined();
  });

  it('preserves interruption signals and process startup errors', async () => {
    const interrupted = childProcess();
    const installation = executeNpmCi('npm');
    interrupted.emit('close', null, 'SIGTERM');
    await expect(installation).rejects.toMatchObject({
      exitCode: 1,
      signal: 'SIGTERM',
    });
    const missing = childProcess();
    const failed = executeNpmCi('missing-npm');
    const error = Object.assign(new Error('not found'), { code: 'ENOENT' });
    missing.emit('error', error);
    await expect(failed).rejects.toBe(error);
  });
});
