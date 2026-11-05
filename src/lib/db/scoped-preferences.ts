import type { AppScope } from '@/lib/domain';
import {
  resumeAccountPreferences,
  writePendingAccountPreference,
} from './account-preference-outbox';
import { getLocalPreference, setLocalPreference } from './local-preferences';

export async function setScopedPreference<TValue>({
  key,
  scope,
  value,
}: {
  key: string;
  scope: AppScope;
  value: TValue;
}): Promise<void> {
  if (scope.kind === 'guest') {
    await setLocalPreference(key, value, scope);
    return;
  }
  await writePendingAccountPreference(scope, key, value);
  void resumeAccountPreferences(scope).catch((error) =>
    console.error('Failed to schedule account preferences.', error),
  );
}

export async function getScopedPreference<TValue>(
  key: string,
  scope: AppScope,
): Promise<TValue | null> {
  return getLocalPreference<TValue>(key, scope);
}
