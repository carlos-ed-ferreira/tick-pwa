import type { Table } from 'dexie';
import type { SyncEntityType } from '@/lib/domain';
import { db } from './database';

export interface PersistedAccountEntity {
  id: string;
  scopeId: string;
  parentId?: string | null;
  clientUpdatedAt: string;
  remoteRevision: number | null;
  syncStatus: 'local' | 'pending' | 'syncing' | 'synced' | 'failed';
}

export const accountEntityTypes: SyncEntityType[] = [
  'categoryTag',
  'dailyEntry',
  'checklistItem',
  'goalGroup',
  'goal',
  'goalStep',
];

export function getAccountEntityTable(entityType: SyncEntityType) {
  if (entityType === 'categoryTag') {
    return db.categoryTags as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'dailyEntry') {
    return db.dailyEntries as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'checklistItem') {
    return db.checklistItems as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'goalGroup') {
    return db.goalGroups as Table<PersistedAccountEntity, string>;
  }

  if (entityType === 'goal') {
    return db.goals as Table<PersistedAccountEntity, string>;
  }

  return db.goalSteps as Table<PersistedAccountEntity, string>;
}

export function createOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const values = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  values[6] = (values[6] & 0x0f) | 0x40;
  values[8] = (values[8] & 0x3f) | 0x80;
  const hex = values.map((value) => value.toString(16).padStart(2, '0'));

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
