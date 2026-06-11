import type { AppScope, SyncEntityType } from '@/lib/domain';
import { getSupabaseBrowserClient } from './client';
import { getRemoteTableName, toRemotePayload } from './entity-mappers';

export async function persistAccountEntity({
  entityType,
  payload,
  scope,
}: {
  scope: AppScope;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
}): Promise<number | null> {
  if (scope.kind !== 'user') {
    return null;
  }

  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const { data, error } = await client
    .from(getRemoteTableName(entityType))
    .upsert(toRemotePayload(scope, entityType, payload), {
      onConflict: 'id',
    })
    .select('revision')
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as { revision?: number } | null;

  return row?.revision ?? null;
}
