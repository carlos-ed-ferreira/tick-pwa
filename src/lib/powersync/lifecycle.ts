import type { PowerSyncBackendConnector } from '@powersync/web';
import type { AppScope } from '@/lib/domain';

export interface PowerSyncPocDatabase {
  close: () => Promise<void>;
  connect: (connector: PowerSyncBackendConnector) => Promise<void>;
  initialize: () => Promise<void>;
}

export type PowerSyncPocDatabaseFactory = (scope: AppScope) => {
  connector: PowerSyncBackendConnector;
  database: PowerSyncPocDatabase;
};

export class PowerSyncPocLifecycle {
  private active: {
    database: PowerSyncPocDatabase;
    scopeId: AppScope['id'];
  } | null = null;

  constructor(
    private readonly createDatabase: PowerSyncPocDatabaseFactory,
    private readonly initializationTimeoutMs = 10_000,
  ) {}

  async start(scope: AppScope): Promise<void> {
    if (scope.kind === 'guest') {
      await this.stop();
      return;
    }

    if (this.active?.scopeId === scope.id) {
      return;
    }

    await this.stop();
    const { connector, database } = this.createDatabase(scope);
    this.active = { database, scopeId: scope.id };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('PowerSync initialization timed out.')),
        this.initializationTimeoutMs,
      );
    });

    try {
      await Promise.race([database.initialize(), timeout]);
    } catch (error) {
      if (this.active?.database === database) {
        this.active = null;
      }
      await database.close();
      throw error;
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }

    void database.connect(connector).catch((error) => {
      console.error('Failed to connect PowerSync proof.', error);
    });
  }

  async stop(): Promise<void> {
    const active = this.active;
    this.active = null;

    if (active) {
      await active.database.close();
    }
  }
}
