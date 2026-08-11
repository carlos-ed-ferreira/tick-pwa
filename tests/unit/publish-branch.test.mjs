import { describe, expect, it, vi } from 'vitest';
import { publishDevelopmentBranch } from '../../scripts/publish-branch.mjs';

function createExecutor(responses) {
  return vi.fn(async () => responses.shift() ?? '');
}

describe('publishDevelopmentBranch', () => {
  it('pushes dev, creates a PR and enables automatic merge', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/1\n',
      '',
    ]);
    const write = vi.fn();

    await publishDevelopmentBranch({ execute, write });

    expect(execute.mock.calls).toEqual([
      ['git', ['branch', '--show-current']],
      ['git', ['status', '--porcelain']],
      ['gh', ['auth', 'status']],
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
          'merge',
          'https://github.com/example/tick/pull/1',
          '--auto',
          '--merge',
        ],
      ],
    ]);
    expect(write).toHaveBeenCalledWith(
      'PR pronto: https://github.com/example/tick/pull/1',
    );
  });

  it('reuses the open PR for dev', async () => {
    const execute = createExecutor([
      'dev\n',
      '',
      '',
      '',
      'https://github.com/example/tick/pull/2\n',
      '',
    ]);

    await publishDevelopmentBranch({ execute, write: vi.fn() });

    expect(execute).not.toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['create']),
    );
    expect(execute).toHaveBeenLastCalledWith('gh', [
      'pr',
      'merge',
      'https://github.com/example/tick/pull/2',
      '--auto',
      '--merge',
    ]);
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
