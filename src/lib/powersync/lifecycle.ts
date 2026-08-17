import type { PowerSyncBackendConnector } from '@powersync/web';
import type { AppScope } from '@/lib/domain';

export interface PowerSyncPocDatabase {
  close: () => Promise<void>;
  connect: (connector: PowerSyncBackendConnector) => Promise<void>;
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
    private readonly connectionTimeoutMs = 10_000,
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
        this.connectionTimeoutMs,
      );
    });

    try {
      await Promise.race([database.connect(connector), timeout]);
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
  }

  async stop(): Promise<void> {
    const active = this.active;
    this.active = null;

    if (active) {
      await active.database.close();
    }
  }
}
