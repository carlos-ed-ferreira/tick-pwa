import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function publishDevelopmentBranch({
  execute = executeCommand,
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

  await execute('gh', ['pr', 'merge', pullRequest, '--auto', '--merge']);
  write(`PR pronto: ${pullRequest}`);
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
