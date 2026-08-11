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

    for (const operation of transaction.crud) {
      if (!isPowerSyncPocTable(operation.table)) {
        throw new Error(`Unsupported PowerSync table: ${operation.table}.`);
      }

      const table = client.from(operation.table);
      const normalizedPayload = normalizePowerSyncPayload({
        table: operation.table,
        payload: operation.opData ?? {},
        userId: session.userId,
      });
      let error: { message: string } | null = null;

      if (operation.op === UpdateType.PUT) {
        const result = await table.upsert(
          { ...normalizedPayload, id: operation.id },
          { onConflict: 'id' },
        );
        error = result.error;
      } else if (operation.op === UpdateType.PATCH) {
        const { user_id: ignoredUserId, ...patch } = normalizedPayload;
        void ignoredUserId;
        const result = await table
          .update(patch)
          .eq('id', operation.id)
          .eq('user_id', session.userId);
        error = result.error;
      } else if (operation.op === UpdateType.DELETE) {
        const result = await table
          .delete()
          .eq('id', operation.id)
          .eq('user_id', session.userId);
        error = result.error;
      }

      if (error) {
        throw new Error(`PowerSync upload failed: ${error.message}`);
      }
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
