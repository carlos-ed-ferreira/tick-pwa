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

  constructor(private readonly createDatabase: PowerSyncPocDatabaseFactory) {}

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

    try {
      await database.connect(connector);
    } catch (error) {
      if (this.active?.database === database) {
        this.active = null;
      }
      await database.close();
      throw error;
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
