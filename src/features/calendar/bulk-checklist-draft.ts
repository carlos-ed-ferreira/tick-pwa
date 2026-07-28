import {
  createRankAfter,
  createId,
  createReorderedRank,
  createSortRankBetween,
  sortByRank,
  buildVisibleTreeRows,
  type VisibleTreeRow,
} from '@/lib/domain';

export interface BulkChecklistDraftItem {
  id: string;
  parentId: string | null;
  text: string;
  scheduledTime: string | null;
  checked: boolean;
  ignored: boolean;
  bold: boolean;
  priority: boolean;
  collapsed: boolean;
  categoryTagId: string | null;
  sortRank: string;
}

export type VisibleBulkChecklistDraftRow =
  VisibleTreeRow<BulkChecklistDraftItem>;

function sortDraftItems(
  items: BulkChecklistDraftItem[],
): BulkChecklistDraftItem[] {
  return sortByRank(items);
}

function createInsertRank({
  siblings,
  afterItemId,
}: {
  siblings: BulkChecklistDraftItem[];
  afterItemId?: string | null;
}): string {
  return createRankAfter({ items: siblings, afterItemId });
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

export function buildVisibleBulkChecklistDraftRows(
  items: BulkChecklistDraftItem[],
): VisibleBulkChecklistDraftRow[] {
  return buildVisibleTreeRows(items);
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
    scheduledTime: null,
    checked: false,
    ignored: false,
    bold: false,
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
  id?: string,
): BulkChecklistDraftItem[] {
  return createBulkChecklistDraftItem(items, {
    id,
    parentId: parentItemId,
  });
}

export function filterBulkChecklistDraftItems(
  items: BulkChecklistDraftItem[],
): BulkChecklistDraftItem[] {
  const filteredItems: BulkChecklistDraftItem[] = [];

  function visit(parentId: string | null) {
    for (const item of sortDraftItems(
      items.filter((currentItem) => currentItem.parentId === parentId),
    )) {
      if (item.text.trim().length === 0) {
        continue;
      }

      filteredItems.push(item);
      visit(item.id);
    }
  }

  visit(null);

  return filteredItems;
}

export function updateBulkChecklistDraftItemText(
  items: BulkChecklistDraftItem[],
  itemId: string,
  text: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({ ...item, text }));
}

export function updateBulkChecklistDraftItemScheduledTime(
  items: BulkChecklistDraftItem[],
  itemId: string,
  scheduledTime: string | null,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({
    ...item,
    scheduledTime,
  }));
}

export function toggleBulkChecklistDraftItemChecked(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => {
    if (item.ignored) {
      return { ...item, checked: false, ignored: false };
    }

    if (item.checked) {
      return { ...item, checked: false, ignored: true };
    }

    return { ...item, checked: true, ignored: false };
  });
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

export function toggleBulkChecklistDraftItemBold(
  items: BulkChecklistDraftItem[],
  itemId: string,
): BulkChecklistDraftItem[] {
  return updateDraftItem(items, itemId, (item) => ({
    ...item,
    bold: !item.bold,
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
  const sortRank = createReorderedRank({
    items: siblings,
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

export function moveBulkChecklistDraftItemToTarget(
  items: BulkChecklistDraftItem[],
  itemId: string,
  targetItemId: string,
  placement: 'before' | 'after',
): BulkChecklistDraftItem[] {
  const item = items.find((currentItem) => currentItem.id === itemId);
  const targetItem = items.find(
    (currentItem) => currentItem.id === targetItemId,
  );

  if (
    !item ||
    !targetItem ||
    item.id === targetItem.id ||
    collectDraftDescendantIds(items, item.id).has(targetItem.parentId ?? '')
  ) {
    return items;
  }

  if (item.parentId !== targetItem.parentId) {
    const siblings = sortDraftItems(
      items.filter(
        (currentItem) =>
          currentItem.parentId === targetItem.parentId &&
          currentItem.id !== item.id,
      ),
    );
    const targetIndex = siblings.findIndex(
      (sibling) => sibling.id === targetItem.id,
    );

    if (targetIndex === -1) {
      return items;
    }

    return updateDraftItem(items, item.id, (currentItem) => ({
      ...currentItem,
      parentId: targetItem.parentId,
      sortRank:
        placement === 'before'
          ? createSortRankBetween(
              siblings[targetIndex - 1]?.sortRank ?? null,
              targetItem.sortRank,
            )
          : createSortRankBetween(
              targetItem.sortRank,
              siblings[targetIndex + 1]?.sortRank ?? null,
            ),
    }));
  }

  const siblings = sortDraftItems(
    items.filter((currentItem) => currentItem.parentId === item.parentId),
  );
  const currentIndex = siblings.findIndex((sibling) => sibling.id === itemId);
  const targetIndex = siblings.findIndex(
    (sibling) => sibling.id === targetItemId,
  );

  if (currentIndex === -1 || targetIndex === -1) {
    return items;
  }

  let nextIndex = placement === 'before' ? targetIndex : targetIndex + 1;

  if (currentIndex < nextIndex) {
    nextIndex -= 1;
  }

  if (nextIndex === currentIndex) {
    return items;
  }

  const direction = nextIndex > currentIndex ? 'down' : 'up';
  let nextItems = items;

  for (let index = 0; index < Math.abs(nextIndex - currentIndex); index += 1) {
    nextItems = reorderBulkChecklistDraftItem(nextItems, itemId, direction);
  }

  return nextItems;
}

export function moveBulkChecklistDraftItemToParent(
  items: BulkChecklistDraftItem[],
  itemId: string,
  parentItemId: string,
): BulkChecklistDraftItem[] {
  const item = items.find((currentItem) => currentItem.id === itemId);
  const parentItem = items.find(
    (currentItem) => currentItem.id === parentItemId,
  );

  if (
    !item ||
    !parentItem ||
    item.id === parentItem.id ||
    collectDraftDescendantIds(items, item.id).has(parentItem.id)
  ) {
    return items;
  }

  const newSiblings = items.filter(
    (currentItem) => currentItem.parentId === parentItem.id,
  );

  return items.map((currentItem) => {
    if (currentItem.id === parentItem.id) {
      return { ...currentItem, collapsed: false };
    }

    if (currentItem.id !== item.id) {
      return currentItem;
    }

    return {
      ...currentItem,
      parentId: parentItem.id,
      sortRank: createInsertRank({ siblings: newSiblings }),
    };
  });
}
