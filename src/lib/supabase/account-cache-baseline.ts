import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db/database';
import {
  accountEntityTypes,
  collectPendingEntityClosure,
  getAccountEntityTable,
} from '@/lib/db/account-entity-tables';

interface CacheVersion {
  scopeId: string;
  id: string;
  clientUpdatedAt: string;
  remoteRevision: number | null;
  syncStatus: string;
}

export async function captureAccountCacheBaseline(scope: AppScope) {
  const tables = accountEntityTypes.map(getAccountEntityTable);
  return db.transaction('r', tables, async () => {
    const versions = new Map<string, Map<string, CacheVersion>>();
    for (const table of tables) {
      const rows = await table.where('scopeId').equals(scope.id).toArray();
      versions.set(table.name, new Map(rows.map((row) => [row.id, row])));
    }
    return {
      versions,
      protectedIds: await collectPendingEntityClosure(scope.id),
    };
  });
}

export function isUnchangedCacheVersion(
  initial: CacheVersion | undefined,
  current: CacheVersion,
): boolean {
  return (
    initial?.syncStatus === 'synced' &&
    current.syncStatus === 'synced' &&
    initial.clientUpdatedAt === current.clientUpdatedAt &&
    initial.remoteRevision === current.remoteRevision
  );
}
