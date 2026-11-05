import type { AppScope, LocalPreference } from '@/lib/domain';
import { createId } from '@/lib/domain';
import { persistAccountPreference } from '@/lib/supabase/account-preferences';
import { db } from './database';
import { createTimestamp } from './entity-metadata';
import {
  enqueueAccountSyncTask,
  withAccountSyncLock,
} from './account-sync-queue';

const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_ATTEMPTS = 5;

export function isAccountPreferencePending(
  preference: LocalPreference | undefined,
): boolean {
  return (
    preference?.syncStatus !== undefined && preference.syncStatus !== 'synced'
  );
}

export async function writePendingAccountPreference<T>(
  scope: AppScope,
  key: string,
  value: T,
): Promise<void> {
  await db.localPreferences.put({
    key: `${scope.id}:${key}`,
    scopeId: scope.id,
    value,
    updatedAt: createTimestamp(),
    syncStatus: 'pending',
    attempts: 0,
    nextAttemptAt: null,
    writeId: createId(),
  });
}

async function updatePreferenceVersion(
  preference: LocalPreference,
  changes: Partial<LocalPreference>,
) {
  await db.transaction('rw', db.localPreferences, async () => {
    const current = await db.localPreferences.get(preference.key);
    if (
      current?.scopeId === preference.scopeId &&
      current.updatedAt === preference.updatedAt &&
      current.writeId === preference.writeId
    ) {
      await db.localPreferences.put({ ...current, ...changes });
    }
  });
}

function scheduleRetry(scope: AppScope, delay: number) {
  const previous = retryTimers.get(scope.id);
  if (previous) clearTimeout(previous);
  retryTimers.set(
    scope.id,
    setTimeout(() => {
      retryTimers.delete(scope.id);
      void resumeAccountPreferences(scope).catch((error) =>
        console.error('Failed to resume account preferences.', error),
      );
    }, delay),
  );
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

async function sendPreference(
  scope: AppScope,
  preference: LocalPreference,
  attempts: number,
) {
  await updatePreferenceVersion(preference, { syncStatus: 'syncing' });
  try {
    await persistAccountPreference({
      key: preference.key.slice(scope.id.length + 1),
      value: preference.value,
      scope,
    });
    await updatePreferenceVersion(preference, {
      syncStatus: 'synced',
      attempts: 0,
      nextAttemptAt: null,
    });
    return true;
  } catch (error) {
    const offline = isBrowserOffline();
    const nextAttempts = offline ? attempts : attempts + 1;
    const delay = Math.min(1000 * 2 ** attempts, 30000);
    await updatePreferenceVersion(preference, {
      syncStatus: offline ? 'pending' : 'failed',
      attempts: nextAttempts,
      nextAttemptAt: offline
        ? null
        : new Date(Date.now() + delay).toISOString(),
    });
    if (!offline && nextAttempts < MAX_ATTEMPTS) scheduleRetry(scope, delay);
    if (!offline)
      console.error('Failed to persist Tick account preference.', error);
    return false;
  }
}

function preferenceAttempts(
  preference: LocalPreference,
  retry: boolean,
): number {
  return retry ? 0 : (preference.attempts ?? 0);
}

function isPreferenceDue(
  scope: AppScope,
  preference: LocalPreference,
  retry: boolean,
): boolean {
  if (retry) return true;
  if (preferenceAttempts(preference, false) >= MAX_ATTEMPTS) return false;
  const remaining = Date.parse(preference.nextAttemptAt ?? '') - Date.now();
  if (remaining > 0) {
    scheduleRetry(scope, remaining);
    return false;
  }
  return true;
}

export async function drainAccountPreferences(
  scope: AppScope,
  retry = false,
): Promise<void> {
  if (scope.kind !== 'user' || isBrowserOffline()) return;
  const preferences = await db.localPreferences
    .where('scopeId')
    .equals(scope.id)
    .toArray();
  for (const preference of preferences.filter(isAccountPreferencePending)) {
    if (isBrowserOffline()) break;
    if (!isPreferenceDue(scope, preference, retry)) continue;
    if (
      !(await sendPreference(
        scope,
        preference,
        preferenceAttempts(preference, retry),
      ))
    )
      break;
  }
}

export function resumeAccountPreferences(
  scope: AppScope,
  retry = false,
): Promise<void> {
  return enqueueAccountSyncTask(scope.id, () =>
    withAccountSyncLock(scope.id, () => drainAccountPreferences(scope, retry)),
  );
}

export async function getAccountPreferenceSyncSummary(scopeId: string) {
  const preferences = await db.localPreferences
    .where('scopeId')
    .equals(scopeId)
    .toArray();
  return {
    pendingCount: preferences.filter((row) => row.syncStatus === 'pending')
      .length,
    syncingCount: preferences.filter((row) => row.syncStatus === 'syncing')
      .length,
    failedCount: preferences.filter((row) => row.syncStatus === 'failed')
      .length,
  };
}
