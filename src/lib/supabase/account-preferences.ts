import type { AppScope, LocalPreference } from '@/lib/domain';
import {
  deleteLocalPreference,
  getLocalPreference,
  setLocalPreference,
} from '@/lib/db/local-preferences';
import { getSupabaseBrowserClient } from './client';
import { db } from '@/lib/db/database';
import type { Json } from './database.types';

export const TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY = 'taskTreeRowActions';
export const GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY =
  'goalStepTreeRowActions';
export const CHECKLIST_VIEW_MODE_PREFERENCE_KEY = 'checklistViewMode';
export const GOAL_STEP_VIEW_MODE_PREFERENCE_KEY = 'goalStepViewMode';
export const CHECKLIST_COMPLETION_STATES_PREFERENCE_KEY =
  'checklistCompletionStates';
export const GOAL_STEP_COMPLETION_STATES_PREFERENCE_KEY =
  'goalStepCompletionStates';
export const ACCOUNT_PREFERENCE_KEYS = [
  TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
  GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY,
  CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
  GOAL_STEP_VIEW_MODE_PREFERENCE_KEY,
  CHECKLIST_COMPLETION_STATES_PREFERENCE_KEY,
  GOAL_STEP_COMPLETION_STATES_PREFERENCE_KEY,
] as const;

export function getTaskTreeRowActionsPreferenceKey(
  surface: 'checklist_item' | 'goal_step',
) {
  return surface === 'goal_step'
    ? GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY
    : TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY;
}

export function getCompletionStatesPreferenceKey(
  surface: 'checklist_item' | 'goal_step',
) {
  return surface === 'goal_step'
    ? GOAL_STEP_COMPLETION_STATES_PREFERENCE_KEY
    : CHECKLIST_COMPLETION_STATES_PREFERENCE_KEY;
}

export function getCategoryViewModePreferenceKey(
  surface: 'checklist_item' | 'goal_step',
) {
  return surface === 'goal_step'
    ? GOAL_STEP_VIEW_MODE_PREFERENCE_KEY
    : CHECKLIST_VIEW_MODE_PREFERENCE_KEY;
}
interface RemoteUserPreference {
  key: string;
  value: Json;
}

function getAccountClient() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account preferences.');
  }

  return client;
}

export async function persistAccountPreference<TValue>({
  key,
  scope,
  value,
}: {
  key: string;
  scope: AppScope;
  value: TValue;
}): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  const { error } = await getAccountClient()
    .from('user_preferences')
    .upsert(
      {
        key,
        user_id: scope.ownerId,
        value: value as Json,
      },
      { onConflict: 'user_id,key' },
    );

  if (error) {
    throw error;
  }
}

function toCanonicalPreferenceValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toCanonicalPreferenceValue);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([entryKey, entryValue]) => [
          entryKey,
          toCanonicalPreferenceValue(entryValue),
        ]),
    );
  }

  return value;
}

function isSamePreferenceValue(
  storedValue: unknown,
  remoteValue: unknown,
): boolean {
  return (
    JSON.stringify(toCanonicalPreferenceValue(storedValue)) ===
    JSON.stringify(toCanonicalPreferenceValue(remoteValue))
  );
}

function canMergePreference(
  initial: LocalPreference | undefined,
  current: LocalPreference | undefined,
): boolean {
  const pending = [initial, current].some(
    (row) => row?.syncStatus && row.syncStatus !== 'synced',
  );
  return (
    !pending &&
    current?.updatedAt === initial?.updatedAt &&
    current?.writeId === initial?.writeId
  );
}

export async function refreshAccountPreferences(
  scope: AppScope,
): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  const baseline = new Map(
    (await db.localPreferences.where('scopeId').equals(scope.id).toArray()).map(
      (row) => [row.key, row],
    ),
  );

  const { data, error } = await getAccountClient()
    .from('user_preferences')
    .select('key,value');

  if (error) {
    throw error;
  }

  const preferences = (data ?? []) as RemoteUserPreference[];
  const preferencesByKey = new Map(
    preferences.map((preference) => [preference.key, preference.value]),
  );

  for (const key of ACCOUNT_PREFERENCE_KEYS) {
    await db.transaction('rw', db.localPreferences, async () => {
      const current = await db.localPreferences.get(`${scope.id}:${key}`);
      const initial = baseline.get(`${scope.id}:${key}`);
      if (!canMergePreference(initial, current)) return;
      const storedValue = await getLocalPreference<Json>(key, scope);

      if (preferencesByKey.has(key)) {
        const remoteValue = preferencesByKey.get(key) ?? null;

        if (!isSamePreferenceValue(storedValue, remoteValue)) {
          await setLocalPreference(key, remoteValue, scope);
        }
      } else if (storedValue !== null) {
        await deleteLocalPreference(key, scope);
      }
    });
  }
}
