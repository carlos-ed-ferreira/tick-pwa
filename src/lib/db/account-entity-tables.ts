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

export interface AccountEntityReference {
  entityType: SyncEntityType;
  id: string;
}

function toReference(
  entity: PersistedAccountEntity,
  key: string,
  entityType: SyncEntityType,
): AccountEntityReference[] {
  const id = (entity as unknown as Record<string, unknown>)[key];

  return typeof id === 'string' && id ? [{ entityType, id }] : [];
}

export function getReferencedAccountEntities(
  entityType: SyncEntityType,
  entity: PersistedAccountEntity,
): AccountEntityReference[] {
  if (entityType === 'checklistItem') {
    return [
      ...toReference(entity, 'dailyEntryId', 'dailyEntry'),
      ...toReference(entity, 'parentId', 'checklistItem'),
      ...toReference(entity, 'categoryTagId', 'categoryTag'),
    ];
  }

  if (entityType === 'goalGroup') {
    return toReference(entity, 'categoryTagId', 'categoryTag');
  }

  if (entityType === 'goal') {
    return [
      ...toReference(entity, 'groupId', 'goalGroup'),
      ...toReference(entity, 'categoryTagId', 'categoryTag'),
    ];
  }

  if (entityType === 'goalStep') {
    return [
      ...toReference(entity, 'goalId', 'goal'),
      ...toReference(entity, 'parentId', 'goalStep'),
      ...toReference(entity, 'categoryTagId', 'categoryTag'),
    ];
  }

  return [];
}

function getEntityIds(
  ids: Map<SyncEntityType, Set<string>>,
  entityType: SyncEntityType,
): Set<string> {
  const existing = ids.get(entityType);

  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  ids.set(entityType, created);

  return created;
}

export async function collectPendingEntityClosure(
  scopeId: string,
): Promise<Map<SyncEntityType, Set<string>>> {
  const closure = new Map<SyncEntityType, Set<string>>();
  const localEntities = new Map<
    SyncEntityType,
    Map<string, PersistedAccountEntity>
  >();
  const queue: AccountEntityReference[] = [];

  for (const entityType of accountEntityTypes) {
    const entities = await getAccountEntityTable(entityType)
      .where('scopeId')
      .equals(scopeId)
      .toArray();
    localEntities.set(
      entityType,
      new Map(entities.map((entity) => [entity.id, entity])),
    );

    const pending = getEntityIds(closure, entityType);

    for (const entity of entities) {
      if (entity.syncStatus !== 'synced') {
        pending.add(entity.id);
        queue.push({ entityType, id: entity.id });
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.pop();

    if (!current) {
      break;
    }

    const entity = localEntities.get(current.entityType)?.get(current.id);

    if (!entity) {
      continue;
    }

    for (const reference of getReferencedAccountEntities(
      current.entityType,
      entity,
    )) {
      const referencedIds = getEntityIds(closure, reference.entityType);

      if (
        referencedIds.has(reference.id) ||
        !localEntities.get(reference.entityType)?.has(reference.id)
      ) {
        continue;
      }

      referencedIds.add(reference.id);
      queue.push(reference);
    }
  }

  return closure;
}
