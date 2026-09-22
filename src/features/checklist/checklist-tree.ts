import type { ChecklistItem } from '@/lib/domain';
import { buildVisibleTreeRows, type VisibleTreeRow } from '@/lib/domain';

export type VisibleChecklistRow = VisibleTreeRow<ChecklistItem>;

export function buildVisibleChecklistRows(
  items: ChecklistItem[],
): VisibleChecklistRow[] {
  return buildVisibleTreeRows(items);
}

export function collectChecklistSubtreeRowIds(
  rows: readonly { item: { id: string; parentId: string | null } }[],
  itemId: string,
): Set<string> {
  const childIdsByParentId = new Map<string, string[]>();

  for (const row of rows) {
    const parentId = row.item.parentId;

    if (!parentId) {
      continue;
    }

    const childIds = childIdsByParentId.get(parentId) ?? [];
    childIds.push(row.item.id);
    childIdsByParentId.set(parentId, childIds);
  }

  const subtreeIds = new Set<string>();
  const visit = (currentId: string) => {
    if (subtreeIds.has(currentId)) {
      return;
    }

    subtreeIds.add(currentId);

    for (const childId of childIdsByParentId.get(currentId) ?? []) {
      visit(childId);
    }
  };

  visit(itemId);

  return subtreeIds;
}
