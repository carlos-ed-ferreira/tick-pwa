import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const url = process.env.TICK_BENCHMARK_SUPABASE_URL;
const key = process.env.TICK_BENCHMARK_SUPABASE_ANON_KEY;
const iterations = Number(process.env.TICK_BENCHMARK_ITERATIONS ?? 30);
const concurrency = Number(process.env.TICK_BENCHMARK_CONCURRENCY ?? 4);
const timeoutMs = Number(process.env.TICK_BENCHMARK_TIMEOUT_MS ?? 10000);

if (!url || !key || !/^http:\/\/(127\.0\.0\.1|localhost):/u.test(url)) {
  throw new Error('The account benchmark only runs against local Supabase.');
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const signIn = await client.auth.signInWithPassword({
  email: 'dev@email.com',
  password: '12341234',
});

if (signIn.error) {
  throw signIn.error;
}

function mutation(id) {
  return {
    entity_type: 'categoryTag',
    base_revision: null,
    payload: {
      id,
      name: 'BENCHMARK',
      color_hex: '#2563eb',
      position: id,
      surface: 'checklist_item',
      use_own_name: false,
      client_updated_at: new Date().toISOString(),
    },
  };
}

async function apply(operationId, mutations) {
  const response = await client.rpc('apply_account_operation_batch', {
    p_operation_id: operationId,
    p_mutations: mutations,
  });

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

function withTimeout(promise) {
  let timeoutId;
  const result = Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('benchmark_timeout')),
        timeoutMs,
      );
    }),
  ]);

  return result.finally(() => clearTimeout(timeoutId));
}

function percentile(values, ratio) {
  const ordered = [...values].sort((first, second) => first - second);
  return ordered[
    Math.min(Math.ceil(ordered.length * ratio) - 1, ordered.length - 1)
  ];
}

async function measure(batchSize) {
  const durations = [];
  let cursor = 0;
  let errors = 0;
  let timeouts = 0;
  const startedAt = performance.now();

  async function worker() {
    while (cursor < iterations) {
      const iteration = cursor;
      cursor += 1;
      const prefix = `benchmark-${batchSize}-${iteration}-${randomUUID()}`;
      const mutations = Array.from({ length: batchSize }, (_, index) =>
        mutation(`${prefix}-${index}`),
      );
      const requestStartedAt = performance.now();

      try {
        await withTimeout(apply(randomUUID(), mutations));
      } catch (error) {
        errors += 1;

        if (error instanceof Error && error.message === 'benchmark_timeout') {
          timeouts += 1;
        }
      }

      durations.push(performance.now() - requestStartedAt);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSeconds = (performance.now() - startedAt) / 1000;

  return {
    batchSize,
    concurrency,
    errors,
    iterations,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    timeouts,
    throughputBatchesPerSecond: iterations / elapsedSeconds,
  };
}

async function measureConflict() {
  const id = `benchmark-conflict-${randomUUID()}`;
  await apply(randomUUID(), [mutation(id)]);
  const update = {
    ...mutation(id),
    base_revision: 1,
  };
  const outcomes = await Promise.allSettled([
    apply(randomUUID(), [update]),
    apply(randomUUID(), [update]),
  ]);

  return {
    confirmed: outcomes.filter((outcome) => outcome.status === 'fulfilled')
      .length,
    conflicts: outcomes.filter((outcome) => outcome.status === 'rejected')
      .length,
  };
}

async function measureReplay() {
  const operationId = randomUUID();
  const mutations = [mutation(`benchmark-replay-${randomUUID()}`)];
  const result = await apply(operationId, mutations);
  const replay = await apply(operationId, mutations);

  return result.operationId === replay.operationId;
}

try {
  const oneMutation = await measure(1);
  const oneHundredMutations = await measure(100);
  const conflict = await measureConflict();
  const idempotentReplay = await measureReplay();

  console.log(
    JSON.stringify(
      { conflict, idempotentReplay, runs: [oneMutation, oneHundredMutations] },
      null,
      2,
    ),
  );
} finally {
  await client.from('category_tags').delete().like('id', 'benchmark-%');
  await client.auth.signOut();
}
