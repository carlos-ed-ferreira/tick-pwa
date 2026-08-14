import {
  PowerSyncDatabase,
  type PowerSyncBackendConnector,
  type SyncStatus,
} from '@powersync/web';
import type { AppScope } from '@/lib/domain';
import { TickPowerSyncPocConnector } from './connector';
import { PowerSyncPocLifecycle } from './lifecycle';
import { tickPowerSyncPocSchema } from './schema';
import { PowerSyncPocSession } from './session';
import {
  PowerSyncPocStore,
  type PowerSyncPocSnapshot,
  type PowerSyncPocWrite,
} from './store';

const ACCOUNT_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const session = new PowerSyncPocSession();
let activeStatusSource: {
  database: Pick<PowerSyncDatabase, 'currentStatus' | 'getUploadQueueStats'>;
  scopeId: AppScope['id'];
} | null = null;

export interface PowerSyncPocStatus {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  hasError: boolean;
  hasSynced: boolean;
  lastSyncedAt: string | null;
  pendingOperations: number;
  uploading: boolean;
}

export function toPowerSyncPocStatus(
  status: Pick<
    SyncStatus,
    | 'connected'
    | 'connecting'
    | 'downloading'
    | 'downloadError'
    | 'hasSynced'
    | 'lastSyncedAt'
    | 'uploadError'
    | 'uploading'
  >,
  pendingOperations: number,
): PowerSyncPocStatus {
  return {
    connected: status.connected,
    connecting: status.connecting,
    downloading: status.downloading,
    hasError: Boolean(status.downloadError || status.uploadError),
    hasSynced: status.hasSynced === true,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    pendingOperations,
    uploading: status.uploading,
  };
}

export function getPowerSyncPocDatabaseFilename(scope: AppScope): string {
  if (
    scope.kind !== 'user' ||
    !ACCOUNT_IDENTIFIER_PATTERN.test(scope.ownerId)
  ) {
    throw new Error('Invalid PowerSync account identifier.');
  }

  return `tick-powersync-poc-v2-${scope.ownerId}.db`;
}

function createPowerSyncPocDatabase(scope: AppScope) {
  const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_URL;

  if (!endpoint) {
    throw new Error('PowerSync endpoint is not configured.');
  }

  const powerSyncDatabase = new PowerSyncDatabase({
    database: {
      dbFilename: getPowerSyncPocDatabaseFilename(scope),
    },
    schema: tickPowerSyncPocSchema,
  });
  const store = new PowerSyncPocStore({
    execute: (sql, parameters) => powerSyncDatabase.execute(sql, parameters),
    getAll: (sql, parameters) =>
      powerSyncDatabase.getAll<Record<string, unknown>>(sql, parameters),
    writeTransaction: (action) =>
      powerSyncDatabase.writeTransaction(async (transaction) => {
        await action({
          execute: (sql, parameters) => transaction.execute(sql, parameters),
        });
      }),
  });
  session.activate(scope, store);
  activeStatusSource = { database: powerSyncDatabase, scopeId: scope.id };

  return {
    connector: new TickPowerSyncPocConnector(endpoint),
    database: {
      close: async () => {
        session.deactivate(scope);

        if (activeStatusSource?.scopeId === scope.id) {
          activeStatusSource = null;
        }

        await powerSyncDatabase.close({ disconnect: true });
      },
      connect: (connector: PowerSyncBackendConnector) =>
        powerSyncDatabase.connect(connector),
    },
  };
}

const lifecycle = new PowerSyncPocLifecycle(createPowerSyncPocDatabase);
let transition: Promise<unknown> = Promise.resolve();

function enqueueTransition<TResult>(
  action: () => Promise<TResult>,
): Promise<TResult> {
  const next = transition.then(action, action);
  transition = next.catch(() => undefined);
  return next;
}

export function startPowerSyncPoc(scope: AppScope): Promise<void> {
  return enqueueTransition(() => lifecycle.start(scope));
}

export function stopPowerSyncPoc(): Promise<void> {
  return enqueueTransition(() => lifecycle.stop());
}

export function readPowerSyncPocSnapshot(
  scope: AppScope,
): Promise<PowerSyncPocSnapshot> {
  return enqueueTransition(() => session.readSnapshot(scope));
}

export function readPowerSyncPocStatus(
  scope: AppScope,
): Promise<PowerSyncPocStatus> {
  return enqueueTransition(async () => {
    if (scope.kind !== 'user' || activeStatusSource?.scopeId !== scope.id) {
      throw new Error('PowerSync proof is not active for this account.');
    }

    const queue = await activeStatusSource.database.getUploadQueueStats();

    return toPowerSyncPocStatus(
      activeStatusSource.database.currentStatus,
      queue.count,
    );
  });
}

export function writePowerSyncPoc(change: PowerSyncPocWrite): Promise<boolean> {
  return enqueueTransition(() => session.write(change));
}

export function writePowerSyncPocBatch(
  changes: PowerSyncPocWrite[],
): Promise<boolean> {
  return enqueueTransition(() => session.writeMany(changes));
}
