import type { AppScope, LocalPreference } from '@/lib/domain';
import { createId } from '@/lib/domain';
import { db } from './database';

export const INSTALLATION_ID_PREFERENCE_KEY = 'installationId';

function scopedPreferenceKey(key: string, scope?: AppScope | null): string {
  return scope ? `${scope.id}:${key}` : key;
}

export async function getLocalPreference<TValue>(
  key: string,
  scope?: AppScope | null,
): Promise<TValue | null> {
  const preference = await db.localPreferences.get(
    scopedPreferenceKey(key, scope),
  );

  return preference ? (preference.value as TValue) : null;
}

export async function setLocalPreference<TValue>(
  key: string,
  value: TValue,
  scope?: AppScope | null,
): Promise<void> {
  const preference: LocalPreference<TValue> = {
    key: scopedPreferenceKey(key, scope),
    scopeId: scope?.id ?? null,
    value,
    updatedAt: new Date().toISOString(),
  };

  await db.localPreferences.put(preference);
}

export async function deleteLocalPreference(
  key: string,
  scope?: AppScope | null,
): Promise<void> {
  await db.localPreferences.delete(scopedPreferenceKey(key, scope));
}

export async function getOrCreateInstallationId(): Promise<string> {
  const existingInstallationId = await getLocalPreference<string>(
    INSTALLATION_ID_PREFERENCE_KEY,
  );

  if (existingInstallationId) {
    return existingInstallationId;
  }

  const installationId = createId();
  await setLocalPreference(INSTALLATION_ID_PREFERENCE_KEY, installationId);

  return installationId;
}
