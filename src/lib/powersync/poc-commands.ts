import type {
  AppScope,
  CategoryTag,
  ChecklistItem,
  DailyEntry,
  LocalDateString,
} from '@/lib/domain';
import { createId, createSortRankBetween } from '@/lib/domain';
import type { PowerSyncPocWrite } from './store';

interface PowerSyncPocScenario {
  category: CategoryTag;
  childItem: ChecklistItem;
  dailyEntry: DailyEntry;
  parentItem: ChecklistItem;
}

function createMetadata(scope: AppScope, timestamp: string) {
  return {
    scopeId: scope.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    clientUpdatedAt: timestamp,
    remoteRevision: null,
    syncStatus: 'pending' as const,
  };
}

export async function createPowerSyncPocScenario({
  categoryName,
  childText,
  createId: generateId = createId,
  date,
  now = () => new Date().toISOString(),
  parentText,
  scope,
  timezone,
  writeMany,
}: {
  categoryName: string;
  childText: string;
  createId?: () => string;
  date: LocalDateString;
  now?: () => string;
  parentText: string;
  scope: AppScope;
  timezone: string;
  writeMany: (changes: PowerSyncPocWrite[]) => Promise<boolean>;
}): Promise<PowerSyncPocScenario> {
  if (scope.kind !== 'user') {
    throw new Error('PowerSync proof requires an authenticated account.');
  }

  const timestamp = now();
  const metadata = createMetadata(scope, timestamp);
  const category: CategoryTag = {
    ...metadata,
    id: generateId(),
    colorHex: '#71717a',
    name: categoryName.normalize('NFC').trim().toLocaleUpperCase(),
    position: createSortRankBetween(null, null),
    surface: 'checklist_item',
    useOwnName: false,
  };
  const dailyEntry: DailyEntry = {
    ...metadata,
    id: generateId(),
    categorySummaries: [],
    categoryTagIds: [],
    completedCount: 0,
    date,
    itemCount: 2,
    note: '',
    previewText: parentText,
    timezone,
    title: '',
  };
  const parentItem: ChecklistItem = {
    ...metadata,
    id: generateId(),
    bold: false,
    categoryTagId: category.id,
    checked: false,
    collapsed: false,
    dailyEntryId: dailyEntry.id,
    ignored: false,
    parentId: null,
    priority: false,
    scheduledTime: null,
    sortRank: createSortRankBetween(null, null),
    text: parentText,
  };
  const childItem: ChecklistItem = {
    ...metadata,
    id: generateId(),
    bold: false,
    categoryTagId: category.id,
    checked: false,
    collapsed: false,
    dailyEntryId: dailyEntry.id,
    ignored: false,
    parentId: parentItem.id,
    priority: false,
    scheduledTime: null,
    sortRank: createSortRankBetween(null, null),
    text: childText,
  };
  const changes: PowerSyncPocWrite[] = [
    {
      baseRevision: null,
      entityType: 'categoryTag',
      payload: category as unknown as Record<string, unknown>,
      scope,
    },
    {
      baseRevision: null,
      entityType: 'dailyEntry',
      payload: dailyEntry as unknown as Record<string, unknown>,
      scope,
    },
    {
      baseRevision: null,
      entityType: 'checklistItem',
      payload: parentItem as unknown as Record<string, unknown>,
      scope,
    },
    {
      baseRevision: null,
      entityType: 'checklistItem',
      payload: childItem as unknown as Record<string, unknown>,
      scope,
    },
  ];

  const written = await writeMany(changes);

  if (!written) {
    throw new Error('PowerSync proof did not persist the local scenario.');
  }

  return { category, childItem, dailyEntry, parentItem };
}
