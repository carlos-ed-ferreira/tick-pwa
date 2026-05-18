import type { AppScope, ChecklistItem, LocalDateString } from '@/lib/domain';
import {
  compareSortRanks,
  createId,
  createSortRankBetween,
} from '@/lib/domain';
import { getDatesInRangeForWeekdays, type WeekdayIndex } from '@/lib/time';
import { db } from './database';
import {
  openOrCreateDailyEntry,
  recalculateDailyEntrySummary,
} from './daily-entry-commands';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { queueSyncOutboxItem } from './sync-outbox';

function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((firstItem, secondItem) =>
    compareSortRanks(firstItem.sortRank, secondItem.sortRank),
  );
}

async function getActiveChecklistItems(
  scope: AppScope,
  dailyEntryId: string,
): Promise<ChecklistItem[]> {
  return db.checklistItems
    .where('[scopeId+dailyEntryId]')
    .equals([scope.id, dailyEntryId])
    .filter((item) => item.deletedAt === null)
    .toArray();
}

function createInsertRank({
  siblings,
  afterItemId,
}: {
  siblings: ChecklistItem[];
  afterItemId?: string | null;
}): string {
  const sortedSiblings = sortChecklistItems(siblings);

  if (!afterItemId) {
    return createSortRankBetween(sortedSiblings.at(-1)?.sortRank ?? null, null);
  }

  const previousIndex = sortedSiblings.findIndex(
    (item) => item.id === afterItemId,
  );

  if (previousIndex === -1) {
    return createSortRankBetween(sortedSiblings.at(-1)?.sortRank ?? null, null);
  }

  return createSortRankBetween(
    sortedSiblings[previousIndex].sortRank,
    sortedSiblings[previousIndex + 1]?.sortRank ?? null,
  );
}

function createReorderedChecklistItemRank({
  siblings,
  itemId,
  direction,
}: {
  siblings: ChecklistItem[];
  itemId: string;
  direction: 'up' | 'down';
}): string | null {
  const sortedSiblings = sortChecklistItems(siblings);
  const currentIndex = sortedSiblings.findIndex((item) => item.id === itemId);

  if (currentIndex === -1) {
    return null;
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (nextIndex < 0 || nextIndex >= sortedSiblings.length) {
    return null;
  }

  const reorderedSiblings = [...sortedSiblings];
  const [movedItem] = reorderedSiblings.splice(currentIndex, 1);
  reorderedSiblings.splice(nextIndex, 0, movedItem);

  return createSortRankBetween(
    reorderedSiblings[nextIndex - 1]?.sortRank ?? null,
    reorderedSiblings[nextIndex + 1]?.sortRank ?? null,
  );
}

async function persistChecklistItemUpdate(
  scope: AppScope,
  item: ChecklistItem,
  changedFields: string[],
): Promise<void> {
  await db.checklistItems.put(item);
  await queueSyncOutboxItem({
    scope,
    entityType: 'checklistItem',
    entityId: item.id,
    operation: item.deletedAt ? 'delete' : 'upsert',
    payload: item as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: item.remoteRevision,
  });
}

function getSortedTemplateChildren(
  templateItems: ChecklistTemplateItem[],
  parentId: string | null,
): ChecklistTemplateItem[] {
  return [...templateItems]
    .filter((item) => item.parentId === parentId)
    .sort((firstItem, secondItem) =>
      compareSortRanks(firstItem.sortRank, secondItem.sortRank),
    );
}

export interface ChecklistTemplateItem {
  id: string;
  parentId: string | null;
  text: string;
  checked: boolean;
  collapsed: boolean;
  categoryTagId: string | null;
  sortRank: string;
}

export async function createChecklistItem({
  scope,
  dailyEntryId,
  parentId = null,
  afterItemId = null,
  text = '',
}: {
  scope: AppScope;
  dailyEntryId: string;
  parentId?: string | null;
  afterItemId?: string | null;
  text?: string;
}): Promise<ChecklistItem> {
  return db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.syncOutbox,
    async () => {
      const dailyEntry = await db.dailyEntries.get(dailyEntryId);

      if (
        !dailyEntry ||
        dailyEntry.scopeId !== scope.id ||
        dailyEntry.deletedAt
      ) {
        throw new Error(
          'Cannot create checklist item for an unavailable daily entry.',
        );
      }

      const activeItems = await getActiveChecklistItems(scope, dailyEntryId);
      const parentItem = parentId
        ? activeItems.find((item) => item.id === parentId)
        : null;
      const safeParentId = parentItem ? parentItem.id : null;
      const siblings = activeItems.filter(
        (item) => item.parentId === safeParentId,
      );
      const now = createTimestamp();
      const item: ChecklistItem = {
        id: createId(),
        scopeId: scope.id,
        dailyEntryId,
        parentId: safeParentId,
        text,
        checked: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: createInsertRank({ siblings, afterItemId }),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...createSyncMetadata(scope, now),
      };

      await db.checklistItems.add(item);
      await queueSyncOutboxItem({
        scope,
        entityType: 'checklistItem',
        entityId: item.id,
        operation: 'upsert',
        payload: item as unknown as Record<string, unknown>,
        changedFields: ['created'],
        baseRevision: null,
      });

      if (parentItem && parentItem.collapsed) {
        const updatedParent = touchChecklistItem(scope, {
          ...parentItem,
          collapsed: false,
        });
        await persistChecklistItemUpdate(scope, updatedParent, ['collapsed']);
      }

      await recalculateDailyEntrySummary({ scope, dailyEntryId });

      return item;
    },
  );
}

export async function createChecklistChild({
  scope,
  dailyEntryId,
  parentItemId,
}: {
  scope: AppScope;
  dailyEntryId: string;
  parentItemId: string;
}): Promise<ChecklistItem> {
  return createChecklistItem({ scope, dailyEntryId, parentId: parentItemId });
}

function touchChecklistItem(
  scope: AppScope,
  item: ChecklistItem,
): ChecklistItem {
  const now = createTimestamp();

  return {
    ...item,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

async function getScopedChecklistItem(
  scope: AppScope,
  itemId: string,
): Promise<ChecklistItem | null> {
  const item = await db.checklistItems.get(itemId);

  if (!item || item.scopeId !== scope.id || item.deletedAt) {
    return null;
  }

  return item;
}

export async function updateChecklistItemText({
  scope,
  itemId,
  text,
}: {
  scope: AppScope;
  itemId: string;
  text: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.syncOutbox,
    async () => {
      const item = await getScopedChecklistItem(scope, itemId);

      if (!item || item.text === text) {
        return;
      }

      const updatedItem = touchChecklistItem(scope, { ...item, text });
      await persistChecklistItemUpdate(scope, updatedItem, ['text']);
      await recalculateDailyEntrySummary({
        scope,
        dailyEntryId: item.dailyEntryId,
      });
    },
  );
}

export async function toggleChecklistItemChecked({
  scope,
  itemId,
}: {
  scope: AppScope;
  itemId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.syncOutbox,
    async () => {
      const item = await getScopedChecklistItem(scope, itemId);

      if (!item) {
        return;
      }

      const updatedItem = touchChecklistItem(scope, {
        ...item,
        checked: !item.checked,
      });
      await persistChecklistItemUpdate(scope, updatedItem, ['checked']);
      await recalculateDailyEntrySummary({
        scope,
        dailyEntryId: item.dailyEntryId,
      });
    },
  );
}

export async function toggleChecklistItemCollapsed({
  scope,
  itemId,
}: {
  scope: AppScope;
  itemId: string;
}): Promise<void> {
  await db.transaction('rw', db.checklistItems, db.syncOutbox, async () => {
    const item = await getScopedChecklistItem(scope, itemId);

    if (!item) {
      return;
    }

    const updatedItem = touchChecklistItem(scope, {
      ...item,
      collapsed: !item.collapsed,
    });
    await persistChecklistItemUpdate(scope, updatedItem, ['collapsed']);
  });
}

export async function assignChecklistItemCategory({
  scope,
  itemId,
  categoryTagId,
}: {
  scope: AppScope;
  itemId: string;
  categoryTagId: string | null;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.categoryTags,
    db.syncOutbox,
    async () => {
      const item = await getScopedChecklistItem(scope, itemId);

      if (!item) {
        return;
      }

      const categoryTag = categoryTagId
        ? await db.categoryTags.get(categoryTagId)
        : null;

      if (
        categoryTagId &&
        (!categoryTag ||
          categoryTag.scopeId !== scope.id ||
          categoryTag.deletedAt)
      ) {
        return;
      }

      const safeCategoryTagId = categoryTag?.id ?? null;

      if (item.categoryTagId === safeCategoryTagId) {
        return;
      }

      const updatedItem = touchChecklistItem(scope, {
        ...item,
        categoryTagId: safeCategoryTagId,
      });
      await persistChecklistItemUpdate(scope, updatedItem, ['categoryTagId']);
      await recalculateDailyEntrySummary({
        scope,
        dailyEntryId: item.dailyEntryId,
      });
    },
  );
}

export async function softDeleteChecklistItem({
  scope,
  itemId,
}: {
  scope: AppScope;
  itemId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.syncOutbox,
    async () => {
      const item = await getScopedChecklistItem(scope, itemId);

      if (!item) {
        return;
      }

      const activeItems = await getActiveChecklistItems(
        scope,
        item.dailyEntryId,
      );
      const childrenByParentId = new Map<string, ChecklistItem[]>();

      for (const activeItem of activeItems) {
        if (!activeItem.parentId) {
          continue;
        }

        const children = childrenByParentId.get(activeItem.parentId) ?? [];
        children.push(activeItem);
        childrenByParentId.set(activeItem.parentId, children);
      }

      const idsToDelete = new Set<string>();
      const visit = (parentItemId: string) => {
        idsToDelete.add(parentItemId);

        for (const child of childrenByParentId.get(parentItemId) ?? []) {
          visit(child.id);
        }
      };
      visit(item.id);

      for (const activeItem of activeItems) {
        if (!idsToDelete.has(activeItem.id)) {
          continue;
        }

        const updatedItem = touchChecklistItem(scope, {
          ...activeItem,
          deletedAt: createTimestamp(),
        });
        await persistChecklistItemUpdate(scope, updatedItem, ['deletedAt']);
      }

      await recalculateDailyEntrySummary({
        scope,
        dailyEntryId: item.dailyEntryId,
      });
    },
  );
}

export async function indentChecklistItem({
  scope,
  itemId,
}: {
  scope: AppScope;
  itemId: string;
}): Promise<void> {
  await db.transaction('rw', db.checklistItems, db.syncOutbox, async () => {
    const item = await getScopedChecklistItem(scope, itemId);

    if (!item) {
      return;
    }

    const activeItems = await getActiveChecklistItems(scope, item.dailyEntryId);
    const siblings = sortChecklistItems(
      activeItems.filter((activeItem) => activeItem.parentId === item.parentId),
    );
    const itemIndex = siblings.findIndex((sibling) => sibling.id === item.id);
    const previousSibling = siblings[itemIndex - 1];

    if (!previousSibling) {
      return;
    }

    const newSiblings = activeItems.filter(
      (activeItem) => activeItem.parentId === previousSibling.id,
    );
    const updatedItem = touchChecklistItem(scope, {
      ...item,
      parentId: previousSibling.id,
      sortRank: createInsertRank({ siblings: newSiblings }),
    });

    await persistChecklistItemUpdate(scope, updatedItem, [
      'parentId',
      'sortRank',
    ]);
  });
}

export async function outdentChecklistItem({
  scope,
  itemId,
}: {
  scope: AppScope;
  itemId: string;
}): Promise<void> {
  await db.transaction('rw', db.checklistItems, db.syncOutbox, async () => {
    const item = await getScopedChecklistItem(scope, itemId);

    if (!item?.parentId) {
      return;
    }

    const activeItems = await getActiveChecklistItems(scope, item.dailyEntryId);
    const parentItem = activeItems.find(
      (activeItem) => activeItem.id === item.parentId,
    );

    if (!parentItem) {
      return;
    }

    const newSiblings = sortChecklistItems(
      activeItems.filter(
        (activeItem) => activeItem.parentId === parentItem.parentId,
      ),
    );
    const parentIndex = newSiblings.findIndex(
      (sibling) => sibling.id === parentItem.id,
    );
    const updatedItem = touchChecklistItem(scope, {
      ...item,
      parentId: parentItem.parentId,
      sortRank: createSortRankBetween(
        parentItem.sortRank,
        newSiblings[parentIndex + 1]?.sortRank ?? null,
      ),
    });

    await persistChecklistItemUpdate(scope, updatedItem, [
      'parentId',
      'sortRank',
    ]);
  });
}

export async function reorderChecklistItem({
  scope,
  itemId,
  direction,
}: {
  scope: AppScope;
  itemId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyEntries,
    db.checklistItems,
    db.syncOutbox,
    async () => {
      const item = await getScopedChecklistItem(scope, itemId);

      if (!item) {
        return;
      }

      const activeItems = await getActiveChecklistItems(
        scope,
        item.dailyEntryId,
      );
      const siblings = activeItems.filter(
        (activeItem) => activeItem.parentId === item.parentId,
      );
      const sortRank = createReorderedChecklistItemRank({
        siblings,
        itemId: item.id,
        direction,
      });

      if (!sortRank) {
        return;
      }

      const updatedItem = touchChecklistItem(scope, {
        ...item,
        sortRank,
      });
      await persistChecklistItemUpdate(scope, updatedItem, ['sortRank']);
      await recalculateDailyEntrySummary({
        scope,
        dailyEntryId: item.dailyEntryId,
      });
    },
  );
}

export async function applyChecklistTemplateToDateRange({
  scope,
  startDate,
  endDate,
  selectedWeekdays,
  templateItems,
  timezone,
}: {
  scope: AppScope;
  startDate: LocalDateString;
  endDate: LocalDateString;
  selectedWeekdays: readonly WeekdayIndex[];
  templateItems: ChecklistTemplateItem[];
  timezone: string;
}): Promise<LocalDateString[]> {
  if (templateItems.length === 0) {
    return [];
  }

  const matchingDates = getDatesInRangeForWeekdays({
    startDate,
    endDate,
    selectedWeekdays,
  });

  for (const date of matchingDates) {
    const dailyEntry = await openOrCreateDailyEntry({
      scope,
      date,
      timezone,
    });

    await db.transaction(
      'rw',
      db.dailyEntries,
      db.checklistItems,
      db.syncOutbox,
      async () => {
        const activeItems = await getActiveChecklistItems(scope, dailyEntry.id);

        async function cloneTemplateChildren({
          sourceParentId,
          targetParentId,
        }: {
          sourceParentId: string | null;
          targetParentId: string | null;
        }): Promise<void> {
          let previousSortRank =
            sortChecklistItems(
              activeItems.filter((item) => item.parentId === targetParentId),
            ).at(-1)?.sortRank ?? null;

          for (const templateItem of getSortedTemplateChildren(
            templateItems,
            sourceParentId,
          )) {
            const now = createTimestamp();
            const item: ChecklistItem = {
              id: createId(),
              scopeId: scope.id,
              dailyEntryId: dailyEntry.id,
              parentId: targetParentId,
              text: templateItem.text,
              checked: templateItem.checked,
              collapsed: templateItem.collapsed,
              categoryTagId: templateItem.categoryTagId,
              sortRank: createSortRankBetween(previousSortRank, null),
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              ...createSyncMetadata(scope, now),
            };

            await db.checklistItems.add(item);
            await queueSyncOutboxItem({
              scope,
              entityType: 'checklistItem',
              entityId: item.id,
              operation: 'upsert',
              payload: item as unknown as Record<string, unknown>,
              changedFields: ['created'],
              baseRevision: null,
            });

            activeItems.push(item);
            previousSortRank = item.sortRank;

            await cloneTemplateChildren({
              sourceParentId: templateItem.id,
              targetParentId: item.id,
            });
          }
        }

        await cloneTemplateChildren({
          sourceParentId: null,
          targetParentId: null,
        });
        await recalculateDailyEntrySummary({
          scope,
          dailyEntryId: dailyEntry.id,
        });
      },
    );
  }

  return matchingDates;
}
