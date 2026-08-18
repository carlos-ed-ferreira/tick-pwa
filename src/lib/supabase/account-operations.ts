import type { AppScope, SyncEntityType } from '@/lib/domain';
import { getSupabaseBrowserClient } from './client';
import { toRemotePayload } from './entity-mappers';

const accountOperationEntityTypes = new Set<SyncEntityType>([
  'categoryTag',
  'dailyEntry',
  'checklistItem',
  'goalGroup',
  'goal',
  'goalStep',
]);

export interface AccountOperationMutation {
  baseRevision: number | null;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
}

export interface AccountOperationResult {
  operationId: string;
  mutations: Array<{
    entityType: SyncEntityType;
    id: string;
    revision: number;
  }>;
}

function isAccountOperationEntityType(
  entityType: SyncEntityType,
): entityType is SyncEntityType {
  return accountOperationEntityTypes.has(entityType);
}

function toAccountOperationMutation(
  scope: AppScope,
  mutation: AccountOperationMutation,
) {
  if (!isAccountOperationEntityType(mutation.entityType)) {
    throw new Error('Account operation batch contains an unsupported entity.');
  }

  const { user_id: ignoredUserId, ...payload } = toRemotePayload(
    scope,
    mutation.entityType,
    mutation.payload,
  );
  void ignoredUserId;

  return {
    base_revision: mutation.baseRevision,
    entity_type: mutation.entityType,
    payload,
  };
}

export async function applyAccountOperationBatch({
  mutations,
  operationId,
  scope,
}: {
  mutations: AccountOperationMutation[];
  operationId: string;
  scope: AppScope;
}): Promise<AccountOperationResult | null> {
  if (scope.kind === 'guest') {
    return null;
  }

  if (mutations.length === 0 || mutations.length > 100) {
    throw new Error('Account operation batch must contain 1 to 100 mutations.');
  }

  const mappedMutations = mutations.map((mutation) =>
    toAccountOperationMutation(scope, mutation),
  );
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account operations.');
  }

  const { data, error } = await client.rpc('apply_account_operation_batch', {
    p_mutations: mappedMutations,
    p_operation_id: operationId,
  });

  if (error) {
    throw error;
  }

  return data as AccountOperationResult;
}
