'use client';

import { useCategoryTags } from '@/features/categories';
import {
  buildCategoryTabs,
  filterRowsByCategoryTab,
  resolveActiveCategoryTab,
  type CategoryTag,
  type Recurrence,
} from '@/lib/domain';
import { useAppContext } from '@/providers';

export function useRecurrenceCategoryFilter(
  recurrences: readonly Recurrence[],
  requestedTabId: string,
) {
  const { dictionary, scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, 'recurrence');
  const rows = recurrences.map((recurrence) => ({ depth: 0, recurrence }));
  const getCategoryTagId = (row: (typeof rows)[number]) =>
    row.recurrence.categoryTagId;
  const tabs = buildCategoryTabs({
    allLabel: dictionary.calendar.categoryTabAll,
    categoryTags,
    getCategoryTagId,
    rows,
    uncategorizedLabel: dictionary.calendar.categoryTabUncategorized,
  });
  const activeTab =
    tabs.length > 2 ? resolveActiveCategoryTab(tabs, requestedTabId) : null;
  const visible = activeTab
    ? filterRowsByCategoryTab({
        activeTabId: activeTab.id,
        getCategoryTagId,
        rows,
        tabs,
      }).map((row) => row.recurrence)
    : [...recurrences];

  return {
    activeTabId: activeTab?.id ?? null,
    categoryTagMap: new Map<string, CategoryTag>(
      categoryTags.map((tag) => [tag.id, tag]),
    ),
    tabs: activeTab ? tabs : [],
    visible,
  };
}
