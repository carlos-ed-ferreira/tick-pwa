import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

async function releaseModule() {
  return import(
    pathToFileURL(`${process.cwd()}/scripts/production-release.mjs`).href
  );
}

const configuration = {
  token: 'test-token',
  projectId: 'prj_test',
  repositoryId: '123',
  sha: 'a'.repeat(40),
  repository: 'owner/tick',
  teamId: '',
};
const ready = {
  id: 'dpl_test',
  url: 'test.vercel.app',
  projectId: 'prj_test',
  target: 'production',
  readyState: 'READY',
  gitSource: { sha: configuration.sha },
  meta: { tickReleaseSha: configuration.sha },
};

describe('production release safety', () => {
  it('requires the security gate and refuses evidence from another SHA', async () => {
    const { assertApprovedChecks } = await releaseModule();
    const checks = [
      'Check app',
      'Check database',
      'Check end-to-end',
      'Check security',
    ].map((name) => ({
      name,
      status: 'completed',
      conclusion: 'success',
      head_sha: configuration.sha,
    }));
    expect(() => assertApprovedChecks(checks, configuration.sha)).not.toThrow();
    expect(() =>
      assertApprovedChecks(checks.slice(0, 3), configuration.sha),
    ).toThrow();
    expect(() => assertApprovedChecks(checks, 'b'.repeat(40))).toThrow();
  });
  it('checks pending migration history independently of the last commit', () => {
    const workflow = readFileSync(
      '.github/workflows/supabase-migrations.yml',
      'utf8',
    );
    expect(workflow).not.toContain('git diff --quiet HEAD^ HEAD');
    expect(workflow).toContain('make supabase-prod-migrations-check');
  });

  it.each(['pending', 'failure', 'cancelled', 'missing'])(
    'rejects an App CI gate that is %s',
    async (state) => {
      const { assertApprovedChecks } = await releaseModule();
      const checks = ['Check app', 'Check database', 'Check end-to-end'].map(
        (name) => ({
          name,
          status: 'completed',
          conclusion: 'success',
          head_sha: configuration.sha,
        }),
      );
      if (state === 'missing') checks.pop();
      else
        Object.assign(checks[2], {
          conclusion: state,
          status: state === 'pending' ? 'in_progress' : 'completed',
        });
      expect(() => assertApprovedChecks(checks, configuration.sha)).toThrow();
    },
  );

  it('creates the approved SHA and waits for READY before smoke tests', async () => {
    const { deployApprovedRelease } = await releaseModule();
    const calls = [];
    let details = 0;
    const request = vi.fn(async (path, options) => {
      calls.push([path, options]);
      if (path === '/v6/deployments') return { deployments: [] };
      if (options?.method === 'POST') return { id: ready.id };
      return { ...ready, readyState: details++ ? 'READY' : 'BUILDING' };
    });
    const smoke = vi.fn();
    await deployApprovedRelease(configuration, {
      request,
      wait: async () => {},
      smoke,
    });
    const creation = calls.find(([, options]) => options?.method === 'POST');
    expect(creation[1].body.gitSource).toMatchObject({
      ref: configuration.sha,
      sha: configuration.sha,
      repoId: '123',
    });
    expect(details).toBe(2);
    expect(smoke).toHaveBeenCalledWith(ready);
  });

  it.each(['ERROR', 'CANCELED'])(
    'fails without smoke on terminal state %s',
    async (state) => {
      const { deployApprovedRelease } = await releaseModule();
      const request = vi.fn(async (path, options) =>
        path === '/v6/deployments'
          ? { deployments: [] }
          : options?.method === 'POST'
            ? { id: ready.id }
            : { ...ready, readyState: state },
      );
      const smoke = vi.fn();
      await expect(
        deployApprovedRelease(configuration, {
          request,
          wait: async () => {},
          smoke,
        }),
      ).rejects.toThrow(state);
      expect(smoke).not.toHaveBeenCalled();
    },
  );

  it('recovers an accepted request whose response was lost without repeating POST', async () => {
    const { deployApprovedRelease } = await releaseModule();
    let listing = 0;
    const request = vi.fn(async (path, options) => {
      if (path === '/v6/deployments')
        return {
          deployments: listing++
            ? [{ ...ready, id: undefined, uid: ready.id }]
            : [],
        };
      if (options?.method === 'POST') throw new TypeError('Lost response');
      return ready;
    });
    await deployApprovedRelease(configuration, {
      request,
      wait: async () => {},
      smoke: async () => {},
    });
    expect(
      request.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });

  it.each([
    { gitSource: { sha: 'b'.repeat(40) } },
    { projectId: 'prj_other' },
    { target: 'preview' },
  ])('refuses a mismatched deployment', async (change) => {
    const { deployApprovedRelease } = await releaseModule();
    const request = vi.fn(async (path, options) =>
      path === '/v6/deployments'
        ? { deployments: [] }
        : options?.method === 'POST'
          ? { id: ready.id }
          : { ...ready, ...change },
    );
    await expect(
      deployApprovedRelease(configuration, {
        request,
        wait: async () => {},
        smoke: async () => {},
      }),
    ).rejects.toThrow();
  });

  it('stops after a bounded wait and propagates smoke failures', async () => {
    const { deployApprovedRelease } = await releaseModule();
    const request = vi.fn(async (path, options) =>
      path === '/v6/deployments'
        ? { deployments: [] }
        : options?.method === 'POST'
          ? { id: ready.id }
          : { ...ready, readyState: 'BUILDING' },
    );
    await expect(
      deployApprovedRelease(configuration, {
        request,
        wait: async () => {},
        smoke: async () => {},
        maxPolls: 2,
      }),
    ).rejects.toThrow('timed out');
    request.mockImplementation(async (path) =>
      path === '/v6/deployments' ? { deployments: [ready] } : ready,
    );
    await expect(
      deployApprovedRelease(configuration, {
        request,
        wait: async () => {},
        smoke: async () => {
          throw new Error('smoke failed');
        },
      }),
    ).rejects.toThrow('smoke failed');
  });
});
