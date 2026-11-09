import { randomUUID } from 'node:crypto';

const workflow = 'supabase-migrations.yml';

async function poll(read, accept, wait, attempts, interval, message) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await read();
    if (accept(result)) return result;
    if (attempt + 1 < attempts) await wait(interval);
  }
  throw new Error(message);
}

async function confirmMain(sha, execute) {
  const current = (
    await execute('gh', [
      'api',
      'repos/{owner}/{repo}/commits/main',
      '--jq',
      '.sha',
    ])
  ).trim();
  if (current !== sha) {
    throw new Error(
      'O SHA solicitado não é mais a ponta da main. Nenhuma publicação foi solicitada.',
    );
  }
}

function listRuns(execute, workflowName, extraArgs, fields) {
  return async () =>
    JSON.parse(
      await execute('gh', [
        'run',
        'list',
        '--workflow',
        workflowName,
        '--branch',
        'main',
        ...extraArgs,
        '--json',
        fields,
      ]),
    );
}

async function waitForAppCi(sha, { execute, wait, write, ciAttempts }) {
  write(`Aguardando App CI da main: ${sha}`);
  const ciRuns = listRuns(
    execute,
    'app-ci.yml',
    ['--event', 'push', '--commit', sha, '--limit', '1'],
    'databaseId,status,conclusion,url,headSha',
  );
  const ci = await poll(
    async () => (await ciRuns()).find((run) => run.headSha === sha),
    (run) => run?.status === 'completed',
    wait,
    ciAttempts,
    10000,
    `App CI não concluiu no prazo. Nenhuma publicação foi solicitada para ${sha}.`,
  );
  if (ci.conclusion !== 'success')
    throw new Error(`App CI reprovado: ${ci.url}`);
}

async function requestPublication(
  sha,
  { execute, wait, write, requestId, discoveryAttempts },
) {
  const title = `Production ${sha} (${requestId})`;
  write(`Solicitando publicação: ${title}`);
  try {
    await execute('gh', [
      'workflow',
      'run',
      workflow,
      '--ref',
      'main',
      '-f',
      `expected_sha=${sha}`,
      '-f',
      `request_id=${requestId}`,
    ]);
  } catch {
    throw new Error(
      `Solicitação sem confirmação: ${title}. Inspecione o Actions antes de repetir; o pedido não foi reenviado.`,
    );
  }
  const releases = listRuns(
    execute,
    workflow,
    ['--event', 'workflow_dispatch', '--limit', '100'],
    'databaseId,displayTitle,url,headSha',
  );
  const run = await poll(
    async () =>
      (await releases()).find(
        (candidate) =>
          candidate.displayTitle === title && candidate.headSha === sha,
      ),
    Boolean,
    wait,
    discoveryAttempts,
    2000,
    `Run não localizado: ${title}. Inspecione o Actions antes de repetir; o pedido não foi reenviado.`,
  );
  return run;
}

export async function publishApprovedCommit(
  sha,
  {
    execute,
    wait,
    write,
    requestId = randomUUID(),
    ciAttempts = 360,
    discoveryAttempts = 30,
    releaseAttempts = 360,
  },
) {
  if (!/^[a-f0-9]{40}$/u.test(sha))
    throw new Error('SHA de publicação inválido.');
  await confirmMain(sha, execute);
  await waitForAppCi(sha, { execute, wait, write, ciAttempts });
  await confirmMain(sha, execute);
  const run = await requestPublication(sha, {
    execute,
    wait,
    write,
    requestId,
    discoveryAttempts,
  });
  write(`Acompanhe a publicação: ${run.url}`);
  const result = await poll(
    async () =>
      JSON.parse(
        await execute('gh', [
          'run',
          'view',
          String(run.databaseId),
          '--json',
          'status,conclusion',
        ]),
      ),
    (candidate) => candidate.status === 'completed',
    wait,
    releaseAttempts,
    10000,
    `A publicação continua sem confirmação: ${run.url}. Interromper a espera não cancela o run.`,
  );
  if (result.conclusion !== 'success') {
    throw new Error(
      `Publicação não concluída (${result.conclusion}): ${run.url}. Confira migrations e deployment antes de retomar.`,
    );
  }
  write(`Produção confirmada (READY e smoke aprovados): ${run.url}`);
  return run;
}
