import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/web';
import { UpdateType } from '@powersync/web';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isPowerSyncPocTable, normalizePowerSyncPayload } from './payload';

export class TickPowerSyncPocConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly endpoint: string,
    private readonly getClient: () => SupabaseClient | null = getSupabaseBrowserClient,
  ) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const session = await this.getSession();

    return session
      ? { endpoint: this.endpoint, token: session.accessToken }
      : null;
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const client = this.getClient();

    if (!client) {
      throw new Error('Supabase is not configured for PowerSync upload.');
    }

    const session = await this.getSession();

    if (!session) {
      throw new Error('An authenticated Supabase session is required.');
    }

    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    const clientId = await database.getClientId();
    const transactionId =
      transaction.transactionId ?? transaction.crud[0]?.clientId;

    if (transactionId === undefined) {
      throw new Error('PowerSync upload transaction has no stable identifier.');
    }

    const operationId = `${clientId}:${transactionId}`;
    const mutations = transaction.crud.map((operation) => {
      if (!isPowerSyncPocTable(operation.table)) {
        throw new Error(`Unsupported PowerSync table: ${operation.table}.`);
      }

      const normalizedPayload = normalizePowerSyncPayload({
        table: operation.table,
        payload: operation.opData ?? {},
        userId: session.userId,
      });
      const { user_id: ignoredUserId, ...payload } = normalizedPayload;
      void ignoredUserId;

      if (
        operation.op !== UpdateType.PUT &&
        operation.op !== UpdateType.PATCH &&
        operation.op !== UpdateType.DELETE
      ) {
        throw new Error(`Unsupported PowerSync operation: ${operation.op}.`);
      }

      return {
        id: operation.id,
        op: operation.op,
        payload,
        table: operation.table,
      };
    });
    const { error } = await client.rpc('apply_powersync_poc_operation_batch', {
      p_mutations: mutations,
      p_operation_id: operationId,
    });

    if (error) {
      throw new Error(`PowerSync upload failed: ${error.message}`);
    }

    await transaction.complete();
  }

  private async getSession(): Promise<{
    accessToken: string;
    userId: string;
  } | null> {
    const client = this.getClient();

    if (!client) {
      return null;
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw new Error(`Could not read Supabase session: ${error.message}`);
    }

    if (!data.session) {
      return null;
    }

    return {
      accessToken: data.session.access_token,
      userId: data.session.user.id,
    };
  }
}
