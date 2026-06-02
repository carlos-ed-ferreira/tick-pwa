import { compareSortRanks } from './sort-rank';

export interface VisibleTreeRow<TItem> {
  item: TItem;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
}

interface TreeItem {
  id: string;
  parentId: string | null;
  collapsed: boolean;
  deletedAt?: string | null;
  sortRank: string;
}

function parentKey(parentId: string | null): string {
  return parentId ?? 'root';
}

export function buildVisibleTreeRows<TItem extends TreeItem>(
  items: readonly TItem[],
): VisibleTreeRow<TItem>[] {
  const childrenByParent = new Map<string, TItem[]>();

  for (const item of items) {
    if (item.deletedAt) {
      continue;
    }

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

  const rows: VisibleTreeRow<TItem>[] = [];
  const visitedItemIds = new Set<string>();

  function appendRows(parentId: string | null, depth: number) {
    const siblings = childrenByParent.get(parentKey(parentId)) ?? [];

    for (const [index, item] of siblings.entries()) {
      if (visitedItemIds.has(item.id)) {
        continue;
      }

      visitedItemIds.add(item.id);
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
