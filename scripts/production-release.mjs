import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const requiredChecks = [
  'Check app',
  'Check database',
  'Check end-to-end',
  'Check security',
];
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function assertApprovedChecks(checks, sha) {
  for (const name of requiredChecks) {
    const check = checks.filter((candidate) => candidate.name === name).at(-1);
    if (
      check?.status !== 'completed' ||
      check.conclusion !== 'success' ||
      check.head_sha !== sha
    ) {
      throw new Error(
        `Required App CI gate is not approved for this SHA: ${name}`,
      );
    }
  }
}

function configurationFromEnvironment() {
  const values = {
    token: process.env.VERCEL_TOKEN,
    projectId: process.env.VERCEL_PROJECT_ID,
    repositoryId: process.env.GITHUB_REPOSITORY_ID,
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.APPROVED_SHA,
    teamId: process.env.VERCEL_TEAM_ID ?? '',
  };
  for (const [key, value] of Object.entries(values)) {
    if (key !== 'teamId' && !value)
      throw new Error(`Missing production release configuration: ${key}`);
  }
  if (
    !/^[a-f0-9]{40}$/u.test(values.sha) ||
    !/^\d+$/u.test(values.repositoryId) ||
    !/^[\w.-]+\/[\w.-]+$/u.test(values.repository)
  )
    throw new Error('Invalid release identity.');
  return values;
}

async function readJson(url, options) {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`Release provider request failed (${response.status}).`);
  return response.json();
}

function vercelRequest(configuration) {
  return (path, { method = 'GET', body, query = {} } = {}) => {
    const url = new URL(path, 'https://api.vercel.com');
    if (configuration.teamId)
      url.searchParams.set('teamId', configuration.teamId);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    return readJson(url, {
      method,
      headers: {
        Authorization: `Bearer ${configuration.token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };
}

async function githubRequest(path) {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('Missing GH_TOKEN.');
  return readJson(new URL(path, 'https://api.github.com'), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
}

async function confirmCurrentCommit(configuration) {
  const commit = await githubRequest(
    `/repos/${configuration.repository}/commits/main`,
  );
  if (commit.sha !== configuration.sha)
    throw new Error('Approved SHA has been superseded.');
}

async function confirmAppCi(configuration) {
  const query = new URLSearchParams({
    branch: 'main',
    event: 'push',
    head_sha: configuration.sha,
    per_page: '10',
  });
  const runs = await githubRequest(
    `/repos/${configuration.repository}/actions/workflows/app-ci.yml/runs?${query}`,
  );
  const run = runs.workflow_runs?.find(
    (candidate) => candidate.head_sha === configuration.sha,
  );
  if (run?.status !== 'completed' || run.conclusion !== 'success')
    throw new Error('App CI is not approved for this SHA.');
  const result = await githubRequest(
    `/repos/${configuration.repository}/actions/runs/${run.id}/jobs?per_page=100`,
  );
  assertApprovedChecks(
    result.jobs.map((job) => ({ ...job, head_sha: run.head_sha })),
    configuration.sha,
  );
}

async function findExistingDeployment(configuration, request) {
  const result = await request('/v6/deployments', {
    query: { projectId: configuration.projectId, limit: 100 },
  });
  return result.deployments?.find(
    (deployment) =>
      deployment.meta?.tickReleaseSha === configuration.sha &&
      deployment.target === 'production' &&
      !['ERROR', 'CANCELED'].includes(
        deployment.readyState ?? deployment.state,
      ),
  );
}

async function createDeployment(configuration, request) {
  const existing = await findExistingDeployment(configuration, request);
  if (existing) return existing;
  try {
    return await request('/v13/deployments', {
      method: 'POST',
      body: {
        name: 'tick',
        project: configuration.projectId,
        target: 'production',
        gitSource: {
          type: 'github',
          repoId: configuration.repositoryId,
          ref: configuration.sha,
          sha: configuration.sha,
        },
        meta: { tickReleaseSha: configuration.sha },
      },
    });
  } catch {
    const accepted = await findExistingDeployment(configuration, request);
    if (accepted) return accepted;
    throw new Error(
      'Deployment creation was not confirmed. Inspect Vercel before retrying; no duplicate POST was sent.',
    );
  }
}

function assertDeploymentIdentity(deployment, configuration) {
  const sha = deployment.gitSource?.sha ?? deployment.meta?.githubCommitSha;
  if (
    sha !== configuration.sha ||
    deployment.projectId !== configuration.projectId ||
    deployment.target !== 'production'
  ) {
    throw new Error(
      'Deployment does not match the approved SHA, project and environment.',
    );
  }
}

export async function smokeDeployment(deployment, sha) {
  if (!/^[a-zA-Z0-9-]+\.vercel\.app$/u.test(deployment.url ?? ''))
    throw new Error('Unexpected deployment hostname.');
  for (const path of ['/', '/calendar', '/goals']) {
    const response = await fetch(`https://${deployment.url}${path}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? {
            'x-vercel-protection-bypass':
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          }
        : {},
    });
    const html = await response.text();
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('text/html') ||
      !html.includes(`name="tick-release" content="${sha}"`)
    )
      throw new Error(`Deployment smoke failed for ${path}.`);
  }
}

export async function deployApprovedRelease(
  configuration,
  {
    request = vercelRequest(configuration),
    wait = pause,
    smoke = (deployment) => smokeDeployment(deployment, configuration.sha),
    maxPolls = 120,
  } = {},
) {
  const deployment = await createDeployment(configuration, request);
  const deploymentId = deployment?.id ?? deployment?.uid;
  if (!/^dpl_[\w-]+$/u.test(deploymentId ?? ''))
    throw new Error('Invalid deployment response.');
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const current = await request(`/v13/deployments/${deploymentId}`);
    assertDeploymentIdentity(current, configuration);
    if (['ERROR', 'CANCELED'].includes(current.readyState))
      throw new Error(`Deployment ${deploymentId}: ${current.readyState}`);
    if (current.readyState === 'READY') {
      await smoke(current);
      return current;
    }
    await wait(5000);
  }
  throw new Error(
    `Deployment ${deploymentId} timed out; inspect Vercel before retrying.`,
  );
}

async function main(command) {
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.GITHUB_REF !== 'refs/heads/main'
  ) {
    throw new Error(
      'Production release commands require GitHub Actions on main.',
    );
  }
  const configuration = configurationFromEnvironment();
  await confirmCurrentCommit(configuration);
  await confirmAppCi(configuration);
  const project = await vercelRequest(configuration)(
    `/v9/projects/${encodeURIComponent(configuration.projectId)}`,
  );
  if (
    String(project.link?.repoId) !== configuration.repositoryId ||
    project.link?.type !== 'github'
  ) {
    throw new Error('Vercel project is linked to a different repository.');
  }
  if (command === 'preflight') return;
  if (command !== 'deploy')
    throw new Error('Unknown production release command.');
  const deployment = await deployApprovedRelease(configuration);
  const summary = `Approved SHA: ${configuration.sha}\nProduction deployment: ${deployment.id} (READY, smoke passed)\n`;
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
