import type {
  AppScope,
  CategoryTag,
  ChecklistItem,
  DailyEntry,
  DailyEntryCategorySummary,
  LocalDateString,
} from '@/lib/domain';
import { createId, createSortRankBetween, sortByRank } from '@/lib/domain';
import type { PowerSyncPocSnapshot, PowerSyncPocWrite } from './store';

interface PowerSyncPocScenario {
  category: CategoryTag;
  childItem: ChecklistItem;
  dailyEntry: DailyEntry;
  parentItem: ChecklistItem;
  siblingItem: ChecklistItem;
}

type PowerSyncPocChecklistAction =
  | { text: string; type: 'update' }
  | { type: 'toggleChecked' }
  | { type: 'moveDown' }
  | { type: 'delete' };

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
  siblingText,
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
  siblingText: string;
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
    categorySummaries: [
      {
        categoryTagId: category.id,
        completedCount: 0,
        itemCount: 3,
      },
    ],
    categoryTagIds: [category.id],
    completedCount: 0,
    date,
    itemCount: 3,
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
  const siblingItem: ChecklistItem = {
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
    sortRank: createSortRankBetween(childItem.sortRank, null),
    text: siblingText,
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
    {
      baseRevision: null,
      entityType: 'checklistItem',
      payload: siblingItem as unknown as Record<string, unknown>,
      scope,
    },
  ];

  const written = await writeMany(changes);

  if (!written) {
    throw new Error('PowerSync proof did not persist the local scenario.');
  }

  return { category, childItem, dailyEntry, parentItem, siblingItem };
}

function createUpdate(
  entityType: PowerSyncPocWrite['entityType'],
  payload: CategoryTag | ChecklistItem | DailyEntry,
  scope: AppScope,
): PowerSyncPocWrite {
  return {
    baseRevision: payload.remoteRevision ?? 0,
    entityType,
    payload: payload as unknown as Record<string, unknown>,
    scope,
  };
}

function touchChecklistItem(
  item: ChecklistItem,
  timestamp: string,
  values: Partial<ChecklistItem>,
): ChecklistItem {
  return {
    ...item,
    ...values,
    clientUpdatedAt: timestamp,
    syncStatus: 'pending',
    updatedAt: timestamp,
  };
}

function createDailyEntrySummary(
  dailyEntry: DailyEntry,
  items: ChecklistItem[],
  timestamp: string,
): DailyEntry {
  const activeItems = items.filter(
    (item) => item.dailyEntryId === dailyEntry.id && item.deletedAt === null,
  );
  const countedItems = activeItems.filter((item) => !item.ignored);
  const categorySummaryMap = new Map<string, DailyEntryCategorySummary>();

  for (const item of activeItems) {
    if (!item.categoryTagId || item.ignored) {
      continue;
    }

    const summary = categorySummaryMap.get(item.categoryTagId) ?? {
      categoryTagId: item.categoryTagId,
      completedCount: 0,
      itemCount: 0,
    };
    summary.itemCount += 1;

    if (item.checked) {
      summary.completedCount += 1;
    }

    categorySummaryMap.set(item.categoryTagId, summary);
  }

  const categorySummaries = Array.from(categorySummaryMap.values());
  const rootItems = sortByRank(
    activeItems.filter((item) => item.parentId === null),
  );
  const previewText =
    rootItems.find((item) => item.text.trim())?.text.trim() ??
    sortByRank(activeItems)
      .find((item) => item.text.trim())
      ?.text.trim() ??
    '';

  return {
    ...dailyEntry,
    categorySummaries,
    categoryTagIds: categorySummaries.map((summary) => summary.categoryTagId),
    clientUpdatedAt: timestamp,
    completedCount: countedItems.filter((item) => item.checked).length,
    itemCount: countedItems.length,
    previewText,
    syncStatus: 'pending',
    updatedAt: timestamp,
  };
}

function getOwnedScenarioEntities({
  itemId,
  scope,
  snapshot,
}: {
  itemId: string;
  scope: AppScope;
  snapshot: PowerSyncPocSnapshot;
}): { dailyEntry: DailyEntry; item: ChecklistItem } {
  if (scope.kind !== 'user') {
    throw new Error('PowerSync proof requires an authenticated account.');
  }

  const item = snapshot.checklistItems.find(
    (candidate) => candidate.id === itemId,
  );

  if (!item || item.scopeId !== scope.id) {
    throw new Error('PowerSync proof cannot mutate another account.');
  }

  const dailyEntry = snapshot.dailyEntries.find(
    (candidate) =>
      candidate.id === item.dailyEntryId && candidate.scopeId === scope.id,
  );

  if (!dailyEntry) {
    throw new Error('PowerSync proof daily entry is unavailable.');
  }

  return { dailyEntry, item };
}

function getSubtree(
  items: ChecklistItem[],
  rootItemId: string,
): ChecklistItem[] {
  const childrenByParentId = new Map<string, ChecklistItem[]>();

  for (const item of items) {
    if (!item.parentId) {
      continue;
    }

    const children = childrenByParentId.get(item.parentId) ?? [];
    children.push(item);
    childrenByParentId.set(item.parentId, children);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const result: ChecklistItem[] = [];

  function visit(itemId: string) {
    const item = byId.get(itemId);

    if (!item) {
      return;
    }

    result.push(item);

    for (const child of sortByRank(childrenByParentId.get(itemId) ?? [])) {
      visit(child.id);
    }
  }

  visit(rootItemId);
  return result;
}

export async function mutatePowerSyncPocChecklistItem({
  action,
  itemId,
  now = () => new Date().toISOString(),
  scope,
  snapshot,
  writeMany,
}: {
  action: PowerSyncPocChecklistAction;
  itemId: string;
  now?: () => string;
  scope: AppScope;
  snapshot: PowerSyncPocSnapshot;
  writeMany: (changes: PowerSyncPocWrite[]) => Promise<boolean>;
}): Promise<void> {
  const { dailyEntry, item } = getOwnedScenarioEntities({
    itemId,
    scope,
    snapshot,
  });
  const ownedItems = snapshot.checklistItems.filter(
    (candidate) =>
      candidate.scopeId === scope.id &&
      candidate.dailyEntryId === item.dailyEntryId,
  );
  const timestamp = now();
  let changes: PowerSyncPocWrite[];

  if (action.type === 'moveDown') {
    const siblings = sortByRank(
      ownedItems.filter(
        (candidate) =>
          candidate.parentId === item.parentId && candidate.deletedAt === null,
      ),
    );
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    const nextItem = siblings[index + 1];

    if (!nextItem) {
      return;
    }

    changes = [
      createUpdate(
        'checklistItem',
        touchChecklistItem(item, timestamp, {
          sortRank: nextItem.sortRank,
        }),
        scope,
      ),
      createUpdate(
        'checklistItem',
        touchChecklistItem(nextItem, timestamp, {
          sortRank: item.sortRank,
        }),
        scope,
      ),
    ];
  } else if (action.type === 'delete') {
    const subtree = getSubtree(ownedItems, item.id);
    const deletedItems = subtree.map((candidate) =>
      touchChecklistItem(candidate, timestamp, { deletedAt: timestamp }),
    );
    const deletedById = new Map(
      deletedItems.map((candidate) => [candidate.id, candidate]),
    );
    const nextItems = ownedItems.map(
      (candidate) => deletedById.get(candidate.id) ?? candidate,
    );
    changes = [
      ...deletedItems.map((candidate) =>
        createUpdate('checklistItem', candidate, scope),
      ),
      createUpdate(
        'dailyEntry',
        createDailyEntrySummary(dailyEntry, nextItems, timestamp),
        scope,
      ),
    ];
  } else {
    const text = action.type === 'update' ? action.text.trim() : item.text;

    if (!text) {
      throw new Error('PowerSync proof item text is required.');
    }

    const updatedItem = touchChecklistItem(item, timestamp, {
      checked: action.type === 'toggleChecked' ? !item.checked : item.checked,
      text,
    });
    const nextItems = ownedItems.map((candidate) =>
      candidate.id === updatedItem.id ? updatedItem : candidate,
    );
    changes = [
      createUpdate('checklistItem', updatedItem, scope),
      createUpdate(
        'dailyEntry',
        createDailyEntrySummary(dailyEntry, nextItems, timestamp),
        scope,
      ),
    ];
  }

  if (!(await writeMany(changes))) {
    throw new Error('PowerSync proof did not persist the local mutation.');
  }
}
