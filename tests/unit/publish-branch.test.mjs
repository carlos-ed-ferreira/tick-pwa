import { describe, expect, it, vi } from 'vitest';
import { publishDevelopmentBranch } from '../../scripts/publish-branch.mjs';

function createExecutor(responses) {
  return vi.fn(async (command, args) => {
    if (args.includes('.mergeCommit.oid')) return 'a'.repeat(40);
    const response = responses.shift() ?? '';

    if (response instanceof Error) {
      throw response;
    }

    return response;
  });
}

function createMissingChecksError() {
  const error = new Error("no required checks reported on the 'dev' branch");
  error.stderr = "no required checks reported on the 'dev' branch";
  return error;
}

describe('publishDevelopmentBranch', () => {
  it('pushes dev, creates a PR and enables automatic merge', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/1\n',
      'PR_example\n',
      '',
      '',
      '',
      'MERGED\n',
      '',
      '',
      '',
    ]);
    const write = vi.fn();

    await publishDevelopmentBranch({ execute, write, release: vi.fn() });

    expect(execute.mock.calls).toEqual([
      ['git', ['branch', '--show-current']],
      ['git', ['status', '--porcelain']],
      ['gh', ['auth', 'status']],
      ['git', ['fetch', 'origin', 'main']],
      ['git', ['merge', '--no-edit', 'origin/main']],
      ['git', ['push', '--set-upstream', 'origin', 'dev']],
      [
        'gh',
        [
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
        ],
      ],
      ['gh', ['pr', 'create', '--base', 'main', '--head', 'dev', '--fill']],
      [
        'gh',
        [
          'pr',
          'view',
          'https://github.com/example/tick/pull/1',
          '--json',
          'id',
          '--jq',
          '.id',
        ],
      ],
      [
        'gh',
        [
          'api',
          'graphql',
          '--silent',
          '-f',
          expect.stringContaining('updateSubscription'),
          '-F',
          'subscribableId=PR_example',
        ],
      ],
      [
        'gh',
        [
          'pr',
          'checks',
          'https://github.com/example/tick/pull/1',
          '--required',
          '--watch',
          '--fail-fast',
        ],
      ],
      [
        'gh',
        [
          'pr',
          'merge',
          'https://github.com/example/tick/pull/1',
          '--auto',
          '--squash',
        ],
      ],
      [
        'gh',
        [
          'pr',
          'view',
          'https://github.com/example/tick/pull/1',
          '--json',
          'state',
          '--jq',
          '.state',
        ],
      ],
      [
        'gh',
        [
          'pr',
          'view',
          'https://github.com/example/tick/pull/1',
          '--json',
          'mergeCommit',
          '--jq',
          '.mergeCommit.oid',
        ],
      ],
      [
        'gh',
        [
          'api',
          '--method',
          'GET',
          'repos/{owner}/{repo}/notifications',
          '-F',
          'all=true',
          '--paginate',
          '--jq',
          expect.stringContaining('/pulls/1'),
        ],
      ],
      ['git', ['fetch', 'origin', 'main']],
      ['git', ['merge', '--no-edit', 'origin/main']],
      ['git', ['push', 'origin', 'dev']],
    ]);
    expect(write).toHaveBeenCalledWith(
      'Main atualizada: https://github.com/example/tick/pull/1',
    );
  });

  it('reuses the open PR for dev', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/2\n',
      'PR_example\n',
      '',
      '',
      '',
      'MERGED\n',
      '',
      '',
      '',
    ]);

    await publishDevelopmentBranch({
      execute,
      write: vi.fn(),
      release: vi.fn(),
    });

    expect(execute).not.toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['create']),
    );
    expect(execute).toHaveBeenCalledWith('gh', [
      'pr',
      'merge',
      'https://github.com/example/tick/pull/2',
      '--auto',
      '--squash',
    ]);
    expect(execute).toHaveBeenLastCalledWith('git', ['push', 'origin', 'dev']);
  });

  it('waits for GitHub to finish the automatic merge', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/3\n',
      'PR_example\n',
      '',
      '',
      '',
      'OPEN\n',
      'MERGED\n',
      '',
      '',
      '',
    ]);
    const wait = vi.fn();

    await publishDevelopmentBranch({
      execute,
      wait,
      write: vi.fn(),
      release: vi.fn(),
    });

    expect(wait).toHaveBeenCalledWith(2_000);
    expect(execute).toHaveBeenLastCalledWith('git', ['push', 'origin', 'dev']);
  });

  it('arms automatic merge only after the required checks pass', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/11\n',
      'PR_example\n',
      '',
      '',
      '',
      'MERGED\n',
      '',
      '',
      '',
    ]);

    await publishDevelopmentBranch({
      execute,
      write: vi.fn(),
      release: vi.fn(),
    });

    const checksCall = execute.mock.calls.findIndex(
      ([command, args]) => command === 'gh' && args[1] === 'checks',
    );
    const mergeCall = execute.mock.calls.findIndex(
      ([command, args]) => command === 'gh' && args[1] === 'merge',
    );

    expect(checksCall).toBeGreaterThan(-1);
    expect(mergeCall).toBeGreaterThan(checksCall);
  });

  it('retries while GitHub has not registered the required check', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/4\n',
      'PR_example\n',
      '',
      createMissingChecksError(),
      '',
      '',
      'MERGED\n',
      '',
      '',
      '',
    ]);
    const wait = vi.fn();

    await publishDevelopmentBranch({
      execute,
      wait,
      write: vi.fn(),
      release: vi.fn(),
    });

    expect(wait).toHaveBeenCalledWith(2_000);
    expect(execute).toHaveBeenLastCalledWith('git', ['push', 'origin', 'dev']);
  });

  it('ignores future pull request notifications and marks the existing thread as done', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/7\n',
      'PR_example\n',
      '',
      '',
      '',
      'MERGED\n',
      'thread-7\n',
      '',
      '',
      '',
      '',
    ]);

    await publishDevelopmentBranch({
      execute,
      write: vi.fn(),
      release: vi.fn(),
    });

    expect(execute).toHaveBeenCalledWith('gh', [
      'pr',
      'view',
      'https://github.com/example/tick/pull/7',
      '--json',
      'id',
      '--jq',
      '.id',
    ]);
    expect(execute).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['graphql', 'subscribableId=PR_example']),
    );
    expect(execute).not.toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['repos/{owner}/{repo}/issues/7/subscription']),
    );
    expect(execute).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining([
        'repos/{owner}/{repo}/notifications',
        expect.stringContaining('/pulls/7'),
      ]),
    );
    expect(execute).toHaveBeenCalledWith('gh', [
      'api',
      '--method',
      'DELETE',
      '--silent',
      'notifications/threads/thread-7',
    ]);
  });

  it('keeps publishing when GitHub refuses to mute the pull request', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/8\n',
      'PR_example\n',
      new Error('HTTP 403'),
      '',
      '',
      'MERGED\n',
      '',
      '',
      '',
    ]);
    const write = vi.fn();

    await publishDevelopmentBranch({
      execute,
      wait: vi.fn(),
      write,
      release: vi.fn(),
    });

    expect(write).toHaveBeenCalledWith(
      'Não foi possível silenciar as notificações do pull request.',
    );
    expect(execute).toHaveBeenLastCalledWith('git', ['push', 'origin', 'dev']);
  });

  it('falls back to ignoring the notification thread when GraphQL refuses the subscription update', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/9\n',
      'PR_example\n',
      new Error('GraphQL: updateSubscription failed'),
      '',
      '',
      'MERGED\n',
      'thread-9\n',
      '',
      '',
      '',
      '',
      '',
    ]);
    const write = vi.fn();

    await publishDevelopmentBranch({ execute, write, release: vi.fn() });

    expect(execute).toHaveBeenCalledWith('gh', [
      'api',
      '--method',
      'PUT',
      '--silent',
      'notifications/threads/thread-9/subscription',
      '-F',
      'ignored=true',
    ]);
    expect(write).not.toHaveBeenCalledWith(
      'Não foi possível silenciar as notificações do pull request.',
    );
  });

  it('keeps waiting when an automatic merge takes longer than 60 seconds', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/10\n',
      'PR_example\n',
      '',
      '',
      '',
      ...Array.from({ length: 30 }, () => 'OPEN\n'),
      'MERGED\n',
      '',
      '',
      '',
      '',
    ]);
    const wait = vi.fn();

    await publishDevelopmentBranch({
      execute,
      wait,
      write: vi.fn(),
      release: vi.fn(),
    });

    expect(wait).toHaveBeenCalledTimes(30);
    expect(execute).toHaveBeenLastCalledWith('git', ['push', 'origin', 'dev']);
  });

  it('starts production only for the merged PR SHA and waits before reporting success', async () => {
    const sha = 'a'.repeat(40);
    const execute = vi.fn(async (command, args) => {
      if (args[0] === 'branch') return 'dev';
      if (args[0] === 'status') return '';
      if (args[1] === 'list') return 'https://github.com/example/tick/pull/1';
      if (args.includes('.state')) return 'MERGED';
      if (args.includes('.mergeCommit.oid')) return sha;
      return '';
    });
    const write = vi.fn();
    const release = vi.fn(async (approvedSha) => {
      expect(approvedSha).toBe(sha);
      expect(write).not.toHaveBeenCalledWith(
        expect.stringContaining('Publicação concluída'),
      );
    });

    await publishDevelopmentBranch({ execute, write, release });

    expect(release).toHaveBeenCalledWith(
      sha,
      expect.objectContaining({ execute, write }),
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Publicação concluída'),
    );
  });

  it('rejects branches other than dev', async () => {
    const execute = createExecutor(['main\n']);

    await expect(
      publishDevelopmentBranch({ execute, write: vi.fn() }),
    ).rejects.toThrow('Execute a publicação a partir da branch dev.');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects uncommitted changes', async () => {
    const execute = createExecutor(['dev\n', ' M package.json\n']);

    await expect(
      publishDevelopmentBranch({ execute, write: vi.fn() }),
    ).rejects.toThrow('Faça commit das alterações antes de publicar.');
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
