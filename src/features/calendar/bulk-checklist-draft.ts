import {
  compareSortRanks,
  createId,
  createSortRankBetween,
} from '@/lib/domain';

export interface BulkChecklistDraftItem {
  id: string;
  parentId: string | null;
  text: string;
  checked: boolean;
  priority: boolean;
  collapsed: boolean;
  categoryTagId: string | null;
  sortRank: string;
}

export interface VisibleBulkChecklistDraftRow {
  item: BulkChecklistDraftItem;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
}

function sortDraftItems(
  items: BulkChecklistDraftItem[],
): BulkChecklistDraftItem[] {
  return [...items].sort((firstItem, secondItem) =>
    compareSortRanks(firstItem.sortRank, secondItem.sortRank),
  );
}

function createInsertRank({
  siblings,
  afterItemId,
}: {
  siblings: BulkChecklistDraftItem[];
  afterItemId?: string | null;
}): string {
  const sortedSiblings = sortDraftItems(siblings);

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

function createReorderedDraftItemRank({
  direction,
  itemId,
  siblings,
}: {
  direction: 'up' | 'down';
  itemId: string;
  siblings: BulkChecklistDraftItem[];
}): string | null {
  const sortedSiblings = sortDraftItems(siblings);
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

function updateDraftItem(
  items: BulkChecklistDraftItem[],
  itemId: string,
  updater: (item: BulkChecklistDraftItem) => BulkChecklistDraftItem,
): BulkChecklistDraftItem[] {
  return items.map((item) => (item.id === itemId ? updater(item) : item));
}

function collectDraftDescendantIds(
  items: BulkChecklistDraftItem[],
  parentItemId: string,
): Set<string> {
  const childrenByParentId = new Map<string, BulkChecklistDraftItem[]>();

  for (const item of items) {
    if (!item.parentId) {
      continue;
    }

    const children = childrenByParentId.get(item.parentId) ?? [];
    children.push(item);
    childrenByParentId.set(item.parentId, children);
  }

  const descendantIds = new Set<string>();
  const stack = [parentItemId];

  while (stack.length > 0) {
    const currentItemId = stack.pop();

    if (!currentItemId) {
      continue;
    }

    descendantIds.add(currentItemId);

    for (const child of childrenByParentId.get(currentItemId) ?? []) {
      stack.push(child.id);
    }
  }

  return descendantIds;
}

function parentKey(parentId: string | null): string {
  return parentId ?? 'root';
}

export function buildVisibleBulkChecklistDraftRows(
  items: BulkChecklistDraftItem[],
): VisibleBulkChecklistDraftRow[] {
  const childrenByParent = new Map<string, BulkChecklistDraftItem[]>();

  for (const item of items) {
    const key = parentKey(item.parentId);
    const children = childrenByParent.get(key) ?? [];
    children.push(item);
    childrenByParent.set(key, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((firstItem, secondItem) =>
      compareSortRanks(firstItem.sortRank, secondItem.sortRank),
    );
  }

  const rows: VisibleBulkChecklistDraftRow[] = [];

  function appendRows(parentId: string | null, depth: number) {
    const siblings = childrenByParent.get(parentKey(parentId)) ?? [];

    for (const [index, item] of siblings.entries()) {
      const children = childrenByParent.get(parentKey(item.id)) ?? [];
      rows.push({
        item,
        depth,
        childCount: children.length,
        hasChildren: children.length > 0,
        isFirstSibling: index === 0,
        isLastSibling: index === siblings.length - 1,
      });

      if (!item.collapsed) {
        appendRows(item.id, depth + 1);
      }
    }
  }

  appendRows(null, 0);

  return rows;
}

export function createBulkChecklistDraftItem(
  items: BulkChecklistDraftItem[],
  {
    id,
    parentId = null,
    afterItemId = null,
    text = '',
  }: {
    id?: string;
    parentId?: string | null;
    afterItemId?: string | null;
    text?: string;
  } = {},
): BulkChecklistDraftItem[] {
  const parentItem = parentId
    ? items.find((item) => item.id === parentId)
    : null;
  const safeParentId = parentItem?.id ?? null;
  const siblings = items.filter((item) => item.parentId === safeParentId);
  const nextItem: BulkChecklistDraftItem = {
    id: id ?? createId(),
    parentId: safeParentId,
    text,
    checked: false,
    priority: false,
    collapsed: false,
    categoryTagId: null,
    sortRank: createInsertRank({ siblings, afterItemId }),
  };

  return items
    .map((item) =>
      item.id === parentItem?.id ? { ...item, collapsed: false } : item,
    )
    .concat(nextItem);
}

export function createBulkChecklistDraftChild(
  items: BulkChecklistDraftItem[],
  parentItemId: string,
): BulkChecklistDraftItem[] {
  return createBulkChecklistDraftItem(items, { parentId: parentItemId });
}

export function updateBulkChecklistDraftItemText(
  items: BulkChecklistDraftItem[],
  itemId: string,
  text: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({ ...item, text }));
}

export function toggleBulkChecklistDraftItemChecked(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({
    ...item,
    checked: !item.checked,
  }));
}

export function toggleBulkChecklistDraftItemPriority(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({
    ...item,
    priority: !item.priority,
  }));
}

export function toggleBulkChecklistDraftItemCollapsed(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({
    ...item,
    collapsed: !item.collapsed,
  }));
}

export function assignBulkChecklistDraftItemCategory(
  items: BulkChecklistDraftItem[],
  itemId: string,
  categoryTagId: string | null,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({
    ...item,
    categoryTagId,
  }));
}

export function deleteBulkChecklistDraftItem(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  const deletedItemIds = collectDraftDescendantIds(items, itemId);

  return items.filter((item) => !deletedItemIds.has(item.id));
}

export function indentBulkChecklistDraftItem(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    return items;
  }

  const siblings = sortDraftItems(
    items.filter((currentItem) => currentItem.parentId === item.parentId),
  );
  const currentIndex = siblings.findIndex((sibling) => sibling.id === item.id);
  const previousSibling = siblings[currentIndex - 1];

  if (!previousSibling) {
    return items;
  }

  const newSiblings = items.filter(
    (currentItem) => currentItem.parentId === previousSibling.id,
  );

  return items.map((currentItem) => {
    if (currentItem.id === previousSibling.id) {
      return { ...currentItem, collapsed: false };
    }

    if (currentItem.id !== item.id) {
      return currentItem;
    }

    return {
      ...currentItem,
      parentId: previousSibling.id,
      sortRank: createInsertRank({ siblings: newSiblings }),
    };
  });
}

export function outdentBulkChecklistDraftItem(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item?.parentId) {
    return items;
  }

  const parentItem = items.find(
    (currentItem) => currentItem.id === item.parentId,
  );

  if (!parentItem) {
    return items;
  }

  const newSiblings = sortDraftItems(
    items.filter((currentItem) => currentItem.parentId === parentItem.parentId),
  );
  const parentIndex = newSiblings.findIndex(
    (sibling) => sibling.id === parentItem.id,
  );

  return updateDraftItem(items, item.id, (currentItem) => ({
    ...currentItem,
    parentId: parentItem.parentId,
    sortRank: createSortRankBetween(
      parentItem.sortRank,
      newSiblings[parentIndex + 1]?.sortRank ?? null,
    ),
  }));
}

export function reorderBulkChecklistDraftItem(
  items: BulkChecklistDraftItem[],
  itemId: string,
  direction: 'up' | 'down',
): BulkChecklistDraftItem[] {
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    return items;
  }

  const siblings = items.filter(
    (currentItem) => currentItem.parentId === item.parentId,
  );
  const sortRank = createReorderedDraftItemRank({
    siblings,
    itemId,
    direction,
  });

  if (!sortRank) {
    return items;
  }

  return updateDraftItem(items, itemId, (currentItem) => ({
    ...currentItem,
    sortRank,
  }));
}
