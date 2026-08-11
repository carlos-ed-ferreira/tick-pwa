import {
  PowerSyncDatabase,
  type PowerSyncBackendConnector,
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

export function getPowerSyncPocDatabaseFilename(scope: AppScope): string {
  if (
    scope.kind !== 'user' ||
    !ACCOUNT_IDENTIFIER_PATTERN.test(scope.ownerId)
  ) {
    throw new Error('Invalid PowerSync account identifier.');
  }

  return `tick-powersync-poc-${scope.ownerId}.db`;
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

  return {
    connector: new TickPowerSyncPocConnector(endpoint),
    database: {
      close: async () => {
        session.deactivate(scope);
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

export function writePowerSyncPoc(change: PowerSyncPocWrite): Promise<boolean> {
  return enqueueTransition(() => session.write(change));
}

export function writePowerSyncPocBatch(
  changes: PowerSyncPocWrite[],
): Promise<boolean> {
  return enqueueTransition(() => session.writeMany(changes));
}
