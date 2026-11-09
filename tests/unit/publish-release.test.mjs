import { describe, expect, it, vi } from 'vitest';
import { publishApprovedCommit } from '../../scripts/publish-release.mjs';

const sha = 'a'.repeat(40);
const requestId = 'request-test';
const run = {
  databaseId: 42,
  headSha: sha,
  displayTitle: `Production ${sha} (${requestId})`,
  url: 'https://github.com/example/tick/actions/runs/42',
};

function setup(overrides = {}) {
  const state = {
    main: sha,
    ci: [
      {
        status: 'completed',
        conclusion: 'success',
        headSha: sha,
        url: 'ci-url',
      },
    ],
    releases: [run],
    result: { status: 'completed', conclusion: 'success' },
    ...overrides,
  };
  const execute = vi.fn(async (command, args) => {
    if (args[0] === 'api') return state.main;
    if (args[0] === 'workflow') {
      if (state.dispatchError) throw state.dispatchError;
      return '';
    }
    if (args[1] === 'list') {
      const runs = args.includes('app-ci.yml') ? state.ci : state.releases;
      return JSON.stringify(runs);
    }
    return JSON.stringify(state.result);
  });
  const options = {
    execute,
    wait: vi.fn(),
    write: vi.fn(),
    requestId,
    ciAttempts: 2,
    discoveryAttempts: 2,
    releaseAttempts: 2,
  };
  return { state, options, execute };
}

describe('explicit publication', () => {
  it('waits for CI, dispatches once with the exact SHA and follows only its own request', async () => {
    const { state, options, execute } = setup({
      ci: [],
      releases: [{ ...run, displayTitle: 'another request' }, run],
    });
    options.wait.mockImplementation(async () => {
      state.ci = [{ status: 'completed', conclusion: 'success', headSha: sha }];
    });

    await expect(publishApprovedCommit(sha, options)).resolves.toEqual(run);

    expect(execute).toHaveBeenCalledWith('gh', [
      'workflow',
      'run',
      'supabase-migrations.yml',
      '--ref',
      'main',
      '-f',
      `expected_sha=${sha}`,
      '-f',
      `request_id=${requestId}`,
    ]);
    expect(execute).toHaveBeenCalledWith('gh', [
      'run',
      'view',
      '42',
      '--json',
      'status,conclusion',
    ]);
    expect(options.write).toHaveBeenLastCalledWith(
      expect.stringContaining('READY e smoke aprovados'),
    );
  });

  it.each(['failure', 'cancelled', 'skipped', 'timed_out'])(
    'never dispatches when CI finishes with %s',
    async (conclusion) => {
      const { options, execute } = setup({
        ci: [{ status: 'completed', conclusion, headSha: sha, url: 'ci-url' }],
      });
      await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
        'App CI reprovado: ci-url',
      );
      expect(execute).not.toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['workflow']),
      );
    },
  );

  it.each([
    { ci: [] },
    { ci: [{ status: 'in_progress', headSha: sha }] },
    {
      ci: [
        { status: 'completed', conclusion: 'success', headSha: 'b'.repeat(40) },
      ],
    },
  ])(
    'bounds the wait and never accepts absent, pending or unrelated CI evidence',
    async ({ ci }) => {
      const { options, execute } = setup({ ci });
      await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
        'App CI não concluiu',
      );
      expect(execute).not.toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['workflow']),
      );
    },
  );

  it('refuses invalid SHAs without contacting GitHub', async () => {
    const { options, execute } = setup();
    await expect(publishApprovedCommit('main', options)).rejects.toThrow('SHA');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a superseded SHA before CI', async () => {
    const { options, execute } = setup({ main: 'b'.repeat(40) });
    await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
      'ponta da main',
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('checks main again after waiting for CI', async () => {
    const { state, options, execute } = setup({ ci: [] });
    options.wait.mockImplementation(async () => {
      state.main = 'b'.repeat(40);
      state.ci = [{ status: 'completed', conclusion: 'success', headSha: sha }];
    });
    await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
      'ponta da main',
    );
    expect(execute).not.toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['workflow']),
    );
  });

  it('never repeats a dispatch whose response was lost', async () => {
    const { options, execute } = setup({
      dispatchError: new Error('lost response'),
    });
    await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
      'Inspecione o Actions',
    );
    expect(
      execute.mock.calls.filter(([, args]) => args[0] === 'workflow'),
    ).toHaveLength(1);
  });

  it('never follows another request or repeats a dispatch while discovery times out', async () => {
    const { options, execute } = setup({
      releases: [{ ...run, displayTitle: 'other' }],
    });
    await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
      'Run não localizado',
    );
    expect(
      execute.mock.calls.filter(([, args]) => args[0] === 'workflow'),
    ).toHaveLength(1);
    expect(execute).not.toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['view']),
    );
  });

  it.each(['failure', 'cancelled', 'skipped', 'timed_out'])(
    'reports the run URL and no success when production finishes with %s',
    async (conclusion) => {
      const { options } = setup({
        result: { status: 'completed', conclusion },
      });
      await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
        run.url,
      );
      expect(options.write).not.toHaveBeenCalledWith(
        expect.stringContaining('READY'),
      );
    },
  );

  it('does not claim or cancel publication when the local wait times out', async () => {
    const { options, execute } = setup({ result: { status: 'queued' } });
    await expect(publishApprovedCommit(sha, options)).rejects.toThrow(
      'não cancela o run',
    );
    expect(execute).not.toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['cancel']),
    );
    expect(options.write).not.toHaveBeenCalledWith(
      expect.stringContaining('READY'),
    );
  });

  it('waits for both run discovery and production completion', async () => {
    const { state, options } = setup({
      releases: [],
      result: { status: 'in_progress' },
    });
    let waits = 0;
    options.wait.mockImplementation(async () => {
      if (waits++ === 0) state.releases = [run];
      else state.result = { status: 'completed', conclusion: 'success' };
    });
    await expect(publishApprovedCommit(sha, options)).resolves.toEqual(run);
    expect(options.wait.mock.calls).toEqual([[2000], [10000]]);
  });
});
