import type { AppScope } from '@/lib/domain';
import type { PowerSyncPocSnapshot, PowerSyncPocWrite } from './store';

interface PowerSyncPocSessionStore {
  readSnapshot: (scope: AppScope) => Promise<PowerSyncPocSnapshot>;
  write: (change: PowerSyncPocWrite) => Promise<boolean>;
  writeMany?: (changes: PowerSyncPocWrite[]) => Promise<boolean>;
}

export class PowerSyncPocSession {
  private active: {
    scopeId: AppScope['id'];
    store: PowerSyncPocSessionStore;
  } | null = null;

  activate(scope: AppScope, store: PowerSyncPocSessionStore): void {
    if (scope.kind !== 'user') {
      throw new Error('PowerSync proof requires an authenticated account.');
    }

    this.active = { scopeId: scope.id, store };
  }

  deactivate(scope: AppScope): void {
    if (this.active?.scopeId === scope.id) {
      this.active = null;
    }
  }

  async readSnapshot(scope: AppScope): Promise<PowerSyncPocSnapshot> {
    return this.getStore(scope).readSnapshot(scope);
  }

  async write(change: PowerSyncPocWrite): Promise<boolean> {
    return this.getStore(change.scope).write(change);
  }

  async writeMany(changes: PowerSyncPocWrite[]): Promise<boolean> {
    if (changes.length === 0) {
      return true;
    }

    const store = this.getStore(changes[0].scope);

    if (!store.writeMany) {
      throw new Error('PowerSync batch writes are not available.');
    }

    return store.writeMany(changes);
  }

  private getStore(scope: AppScope): PowerSyncPocSessionStore {
    if (scope.kind !== 'user' || this.active?.scopeId !== scope.id) {
      throw new Error('PowerSync proof is not active for this account.');
    }

    return this.active.store;
  }
}
