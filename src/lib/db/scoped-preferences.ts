import type { AppScope } from '@/lib/domain';
import {
  clearAccountPreferencePending,
  hasNewerAccountPreferenceWrite,
  markAccountPreferencePending,
  persistAccountPreference,
  restoreAccountPreference,
} from '@/lib/supabase/account-preferences';
import { enqueueAccountPersistence } from './account-persistence';
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
  await setLocalPreference(key, value, scope);

  if (scope.kind === 'guest') {
    return;
  }

  markAccountPreferencePending(scope.id, key);
  enqueueAccountPersistence(scope.id, async () => {
    try {
      await persistAccountPreference({ key, scope, value });
    } catch (error) {
      console.error('Failed to persist Tick account preference.', error);

      if (!hasNewerAccountPreferenceWrite(scope.id, key)) {
        try {
          await restoreAccountPreference({ key, scope });
        } catch (restoreError) {
          console.error(
            'Failed to restore Tick account preference after persistence error.',
            restoreError,
          );
        }
      }
    } finally {
      clearAccountPreferencePending(scope.id, key);
    }
  });
}

export async function getScopedPreference<TValue>(
  key: string,
  scope: AppScope,
): Promise<TValue | null> {
  return getLocalPreference<TValue>(key, scope);
}
