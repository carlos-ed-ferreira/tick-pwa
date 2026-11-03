import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import {
  readBenchmarkOptions,
  summarizeMeasurements,
} from './benchmark-statistics.mjs';

const url = process.env.TICK_BENCHMARK_SUPABASE_URL;
const key = process.env.TICK_BENCHMARK_SUPABASE_ANON_KEY;
const options = readBenchmarkOptions(process.env, url);
if (!key) throw new Error('Missing local Supabase anonymous key.');
const { iterations, concurrency, timeoutMs, fixtureRows } = options;
const prefix = `benchmark-${randomUUID()}`;
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init = {}) =>
      fetch(input, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      }),
  },
});
const signIn = await client.auth.signInWithPassword({
  email: 'dev@email.com',
  password: '12341234',
});
if (signIn.error) throw signIn.error;
const userId = signIn.data.user.id;

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
  if (response.error) throw response.error;
  return response.data;
}

async function measure(batchSize) {
  const durations = [];
  let cursor = 0;
  let errors = 0;
  let timeouts = 0;
  const startedAt = performance.now();
  async function worker() {
    while (cursor < iterations) {
      const iteration = cursor++;
      const mutations = Array.from({ length: batchSize }, (_, index) =>
        mutation(`${prefix}-${batchSize}-${iteration}-${index}`),
      );
      const requestStartedAt = performance.now();
      try {
        await apply(randomUUID(), mutations);
        durations.push(performance.now() - requestStartedAt);
      } catch (error) {
        errors += 1;
        if (/timeout|abort/iu.test(String(error?.message ?? error)))
          timeouts += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    batchSize,
    concurrency,
    iterations,
    timeouts,
    ...summarizeMeasurements(durations, errors, performance.now() - startedAt),
  };
}

async function prepareFixture() {
  const goalId = `${prefix}-goal`;
  const goal = await client.from('goals').insert({
    id: goalId,
    user_id: userId,
    title: 'Synthetic mature goal',
    sort_rank: 'a0',
  });
  if (goal.error) throw goal.error;
  for (let offset = 0; offset < fixtureRows; offset += 100) {
    const rows = Array.from(
      { length: Math.min(100, fixtureRows - offset) },
      (_, index) => {
        const position = offset + index;
        return {
          id: `${prefix}-step-${String(position).padStart(6, '0')}`,
          user_id: userId,
          goal_id: goalId,
          parent_id:
            position % 20
              ? `${prefix}-step-${String(position - 1).padStart(6, '0')}`
              : null,
          text: 'Synthetic capacity item',
          sort_rank: String(position).padStart(6, '0'),
        };
      },
    );
    const result = await client.from('goal_steps').insert(rows);
    if (result.error) throw result.error;
  }
  return goalId;
}

async function measureFirstPull(goalId) {
  const startedAt = performance.now();
  let rows = 0;
  let pages = 0;
  let bytes = 0;
  const pageSize = 500;
  for (let offset = 0; offset < fixtureRows; offset += pageSize) {
    const response = await client
      .from('goal_steps')
      .select('*')
      .eq('goal_id', goalId)
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (response.error) throw response.error;
    rows += response.data.length;
    pages += 1;
    bytes += Buffer.byteLength(JSON.stringify(response.data));
  }
  if (rows !== fixtureRows) throw new Error('Incomplete synthetic first pull.');
  return {
    durationMs: performance.now() - startedAt,
    rows,
    pages,
    bytes,
    pageSize,
  };
}

async function measureConflict() {
  const id = `${prefix}-conflict`;
  await apply(randomUUID(), [mutation(id)]);
  const update = { ...mutation(id), base_revision: 1 };
  const outcomes = await Promise.allSettled([
    apply(randomUUID(), [update]),
    apply(randomUUID(), [update]),
  ]);
  return {
    confirmed: outcomes.filter((outcome) => outcome.status === 'fulfilled')
      .length,
    rejected: outcomes.filter((outcome) => outcome.status === 'rejected')
      .length,
    rejectionReasons: outcomes
      .filter((outcome) => outcome.status === 'rejected')
      .map((outcome) => ({
        code: outcome.reason?.code,
        message: outcome.reason?.message,
      })),
    concurrencyConflictRejected: outcomes.some(
      (outcome) =>
        outcome.status === 'rejected' &&
        (String(outcome.reason?.message).includes('stale_revision') ||
          outcome.reason?.code === 'PT409'),
    ),
  };
}

async function measureReplay() {
  const operationId = randomUUID();
  const mutations = [mutation(`${prefix}-replay`)];
  const result = await apply(operationId, mutations);
  const replay = await apply(operationId, mutations);
  return result.operationId === replay.operationId;
}

try {
  const fixtureGoalId = await prepareFixture();
  const firstPull = await measureFirstPull(fixtureGoalId);
  const runs = [];
  for (const batchSize of [1, 100]) runs.push(await measure(batchSize));
  const conflict = await measureConflict();
  const idempotentReplay = await measureReplay();
  const report = {
    createdAt: new Date().toISOString(),
    nodeVersion: process.version,
    options,
    fixture: { rows: fixtureRows, maximumDepth: Math.min(20, fixtureRows) },
    firstPull,
    conflict,
    idempotentReplay,
    runs,
  };
  if (process.env.TICK_BENCHMARK_REPORT) {
    const reportPath = path.resolve(process.env.TICK_BENCHMARK_REPORT);
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
  if (
    runs.some((run) => run.errors) ||
    !idempotentReplay ||
    conflict.confirmed !== 1 ||
    conflict.rejected !== 1 ||
    !conflict.concurrencyConflictRejected
  ) {
    throw new Error('Capacity benchmark failed its correctness checks.');
  }
} finally {
  for (const table of ['goal_steps', 'goals', 'category_tags']) {
    const result = await client.from(table).delete().like('id', `${prefix}%`);
    if (result.error)
      throw new Error(`Synthetic fixture cleanup failed for ${table}.`);
  }
  await client.auth.signOut();
}
