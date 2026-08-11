import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function publishDevelopmentBranch({
  execute = executeCommand,
  wait = delay,
  write = console.log,
} = {}) {
  const branch = (await execute('git', ['branch', '--show-current'])).trim();

  if (branch !== 'dev') {
    throw new Error('Execute a publicação a partir da branch dev.');
  }

  const worktree = (await execute('git', ['status', '--porcelain'])).trim();

  if (worktree) {
    throw new Error('Faça commit das alterações antes de publicar.');
  }

  await execute('gh', ['auth', 'status']);
  await execute('git', ['fetch', 'origin', 'main']);
  await execute('git', ['merge', '--no-edit', 'origin/main']);
  await execute('git', ['push', '--set-upstream', 'origin', 'dev']);

  const openPullRequest = (
    await execute('gh', [
      'pr',
      'list',
      '--base',
      'main',
      '--head',
      'dev',
      '--state',
      'open',
      '--json',
      'url',
      '--jq',
      '.[0].url',
    ])
  ).trim();
  const pullRequest =
    openPullRequest ||
    (
      await execute('gh', [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        'dev',
        '--fill',
      ])
    ).trim();

  if (!pullRequest) {
    throw new Error('O GitHub não retornou a URL do pull request.');
  }

  await execute('gh', ['pr', 'merge', pullRequest, '--auto', '--squash']);
  await waitForRequiredChecks(pullRequest, execute, wait);
  await waitForMergedPullRequest(pullRequest, execute, wait);
  await execute('git', ['fetch', 'origin', 'main']);
  await execute('git', ['merge', '--no-edit', 'origin/main']);
  await execute('git', ['push', 'origin', 'dev']);
  write(`Main atualizada: ${pullRequest}`);
}

async function waitForRequiredChecks(pullRequest, execute, wait) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await execute('gh', [
        'pr',
        'checks',
        pullRequest,
        '--required',
        '--watch',
        '--fail-fast',
      ]);
      return;
    } catch (error) {
      if (!isMissingRequiredChecksError(error)) {
        throw error;
      }
    }

    await wait(2_000);
  }

  throw new Error(
    'O GitHub não registrou os checks obrigatórios dentro de 60 segundos.',
  );
}

function isMissingRequiredChecksError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const stderr =
    error && typeof error === 'object' && 'stderr' in error
      ? String(error.stderr)
      : '';

  return `${message}\n${stderr}`.includes('no required checks reported');
}

async function waitForMergedPullRequest(pullRequest, execute, wait) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = (
      await execute('gh', [
        'pr',
        'view',
        pullRequest,
        '--json',
        'state',
        '--jq',
        '.state',
      ])
    ).trim();

    if (state === 'MERGED') {
      return;
    }

    if (state !== 'OPEN') {
      throw new Error(`O pull request terminou no estado ${state}.`);
    }

    await wait(2_000);
  }

  throw new Error('O merge automático não terminou dentro de 60 segundos.');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function executeCommand(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (stderr) {
    process.stderr.write(stderr);
  }

  return stdout;
}

const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (executedFile === fileURLToPath(import.meta.url)) {
  try {
    await publishDevelopmentBranch();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
