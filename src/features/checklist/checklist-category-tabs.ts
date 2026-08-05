import type { CategoryTag } from '@/lib/domain';

export const ALL_CHECKLIST_CATEGORY_TAB_ID = 'all';
export const UNCATEGORIZED_CHECKLIST_CATEGORY_TAB_ID = 'uncategorized';

export interface ChecklistCategoryTab {
  categoryTagId: string | null;
  colorHex: string | null;
  id: string;
  name: string;
}

interface ChecklistCategoryTabRow {
  depth: number;
  item: { categoryTagId: string | null };
}

function isRootRow(row: ChecklistCategoryTabRow): boolean {
  return row.depth === 0;
}

export function buildChecklistCategoryTabs<
  TRow extends ChecklistCategoryTabRow,
>({
  allLabel,
  categoryTags,
  rows,
  uncategorizedLabel,
}: {
  allLabel: string;
  categoryTags: readonly CategoryTag[];
  rows: readonly TRow[];
  uncategorizedLabel: string;
}): ChecklistCategoryTab[] {
  const rootRows = rows.filter(isRootRow);
  const rootCategoryTagIds = new Set(
    rootRows
      .map((row) => row.item.categoryTagId)
      .filter(
        (categoryTagId): categoryTagId is string => categoryTagId !== null,
      ),
  );
  const categoryTabs = categoryTags
    .filter((categoryTag) => rootCategoryTagIds.has(categoryTag.id))
    .map((categoryTag) => ({
      categoryTagId: categoryTag.id,
      colorHex: categoryTag.colorHex,
      id: categoryTag.id,
      name: categoryTag.name,
    }));
  const allTab: ChecklistCategoryTab = {
    categoryTagId: null,
    colorHex: null,
    id: ALL_CHECKLIST_CATEGORY_TAB_ID,
    name: allLabel,
  };

  // Splitting only between "all" and "uncategorized" would show the same list
  // twice, so the tab strip only makes sense once a category is in use.
  if (categoryTabs.length === 0) {
    return [allTab];
  }

  const tabCategoryTagIds = new Set(
    categoryTabs.map((tab) => tab.categoryTagId),
  );
  const hasUncategorizedRootRow = rootRows.some(
    (row) =>
      row.item.categoryTagId === null ||
      !tabCategoryTagIds.has(row.item.categoryTagId),
  );

  return hasUncategorizedRootRow
    ? [
        allTab,
        ...categoryTabs,
        {
          categoryTagId: null,
          colorHex: null,
          id: UNCATEGORIZED_CHECKLIST_CATEGORY_TAB_ID,
          name: uncategorizedLabel,
        },
      ]
    : [allTab, ...categoryTabs];
}

export function resolveActiveChecklistCategoryTab(
  tabs: readonly ChecklistCategoryTab[],
  activeTabId: string,
): ChecklistCategoryTab | null {
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
}

export function filterChecklistRowsByCategoryTab<
  TRow extends ChecklistCategoryTabRow,
>({
  activeTabId,
  rows,
  tabs,
}: {
  activeTabId: string;
  rows: readonly TRow[];
  tabs: readonly ChecklistCategoryTab[];
}): TRow[] {
  if (activeTabId === ALL_CHECKLIST_CATEGORY_TAB_ID) {
    return [...rows];
  }

  const tabCategoryTagIds = new Set(
    tabs
      .map((tab) => tab.categoryTagId)
      .filter(
        (categoryTagId): categoryTagId is string => categoryTagId !== null,
      ),
  );
  const visibleRows: TRow[] = [];
  let isVisibleSubtree = false;

  for (const row of rows) {
    if (isRootRow(row)) {
      const categoryTagId = row.item.categoryTagId;
      const rowTabId =
        categoryTagId !== null && tabCategoryTagIds.has(categoryTagId)
          ? categoryTagId
          : UNCATEGORIZED_CHECKLIST_CATEGORY_TAB_ID;

      isVisibleSubtree = rowTabId === activeTabId;
    }

    if (isVisibleSubtree) {
      visibleRows.push(row);
    }
  }

  return visibleRows;
}
