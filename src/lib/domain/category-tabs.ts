import type { CategoryTag } from './types';

export const ALL_CATEGORY_TAB_ID = 'all';
export const UNCATEGORIZED_CATEGORY_TAB_ID = 'uncategorized';

export interface CategoryTab {
  categoryTagId: string | null;
  colorHex: string | null;
  id: string;
  name: string;
}

interface CategoryTabRow {
  depth: number;
}

function isRootRow(row: CategoryTabRow): boolean {
  return row.depth === 0;
}

export function buildCategoryTabs<TRow extends CategoryTabRow>({
  allLabel,
  categoryTags,
  getCategoryTagId,
  rows,
  uncategorizedLabel,
}: {
  allLabel: string;
  categoryTags: readonly CategoryTag[];
  getCategoryTagId: (row: TRow) => string | null;
  rows: readonly TRow[];
  uncategorizedLabel: string;
}): CategoryTab[] {
  const rootRows = rows.filter(isRootRow);
  const rootCategoryTagIds = new Set(
    rootRows
      .map(getCategoryTagId)
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
  const allTab: CategoryTab = {
    categoryTagId: null,
    colorHex: null,
    id: ALL_CATEGORY_TAB_ID,
    name: allLabel,
  };

  if (categoryTabs.length === 0) {
    return [allTab];
  }

  const tabCategoryTagIds = new Set(
    categoryTabs.map((tab) => tab.categoryTagId),
  );
  const hasUncategorizedRootRow = rootRows.some((row) => {
    const categoryTagId = getCategoryTagId(row);

    return categoryTagId === null || !tabCategoryTagIds.has(categoryTagId);
  });

  return hasUncategorizedRootRow
    ? [
        allTab,
        ...categoryTabs,
        {
          categoryTagId: null,
          colorHex: null,
          id: UNCATEGORIZED_CATEGORY_TAB_ID,
          name: uncategorizedLabel,
        },
      ]
    : [allTab, ...categoryTabs];
}

export function resolveActiveCategoryTab(
  tabs: readonly CategoryTab[],
  activeTabId: string,
): CategoryTab | null {
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
}

export function filterRowsByCategoryTab<TRow extends CategoryTabRow>({
  activeTabId,
  getCategoryTagId,
  rows,
  tabs,
}: {
  activeTabId: string;
  getCategoryTagId: (row: TRow) => string | null;
  rows: readonly TRow[];
  tabs: readonly CategoryTab[];
}): TRow[] {
  if (activeTabId === ALL_CATEGORY_TAB_ID) {
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
      const categoryTagId = getCategoryTagId(row);
      const rowTabId =
        categoryTagId !== null && tabCategoryTagIds.has(categoryTagId)
          ? categoryTagId
          : UNCATEGORIZED_CATEGORY_TAB_ID;

      isVisibleSubtree = rowTabId === activeTabId;
    }

    if (isVisibleSubtree) {
      visibleRows.push(row);
    }
  }

  return visibleRows;
}
