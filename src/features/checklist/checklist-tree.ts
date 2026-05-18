import type { ChecklistItem } from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';

export interface VisibleChecklistRow {
  item: ChecklistItem;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
}

function parentKey(parentId: string | null): string {
  return parentId ?? 'root';
}

export function buildVisibleChecklistRows(
  items: ChecklistItem[],
): VisibleChecklistRow[] {
  const childrenByParent = new Map<string, ChecklistItem[]>();

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

  const rows: VisibleChecklistRow[] = [];
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
