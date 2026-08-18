import { describe, expect, it } from 'vitest';
import {
  ALL_CATEGORY_TAB_ID,
  UNCATEGORIZED_CATEGORY_TAB_ID,
  buildCategoryTabs,
  filterRowsByCategoryTab,
  resolveActiveCategoryTab,
  type CategoryTag,
} from '@/lib/domain';

function createCategoryTag(
  id: string,
  overrides: Partial<CategoryTag> = {},
): CategoryTag {
  const now = new Date().toISOString();

  return {
    id,
    scopeId: 'guest:test',
    name: id.toUpperCase(),
    colorHex: '#2563eb',
    position: 'U',
    surface: 'checklist_item',
    useOwnName: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: now,
    ...overrides,
  };
}

function createRow(
  id: string,
  {
    categoryTagId = null,
    depth = 0,
  }: { categoryTagId?: string | null; depth?: number } = {},
) {
  return { depth, item: { categoryTagId, id } };
}

const tabOptions = {
  allLabel: 'All',
  getCategoryTagId: (row: ReturnType<typeof createRow>) =>
    row.item.categoryTagId,
  uncategorizedLabel: 'No category',
};

describe('buildCategoryTabs', () => {
  it('keeps only the all tab when no root item has a category', () => {
    const tabs = buildCategoryTabs({
      ...tabOptions,
      categoryTags: [createCategoryTag('focus')],
      rows: [createRow('a'), createRow('b')],
    });

    expect(tabs.map((tab) => tab.id)).toEqual([ALL_CATEGORY_TAB_ID]);
  });

  it('orders the tabs as all, used categories, and uncategorized last', () => {
    const tabs = buildCategoryTabs({
      ...tabOptions,
      categoryTags: [
        createCategoryTag('focus', { name: 'FOCUS' }),
        createCategoryTag('health', { name: 'HEALTH' }),
        createCategoryTag('home', { name: 'HOME' }),
      ],
      rows: [
        createRow('a', { categoryTagId: 'home' }),
        createRow('b', { categoryTagId: 'focus' }),
        createRow('c'),
      ],
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      ALL_CATEGORY_TAB_ID,
      'focus',
      'home',
      UNCATEGORIZED_CATEGORY_TAB_ID,
    ]);
    expect(tabs.map((tab) => tab.name)).toEqual([
      'All',
      'FOCUS',
      'HOME',
      'No category',
    ]);
    expect(tabs[1].colorHex).toBe('#2563eb');
  });

  it('ignores categories that only appear on child rows', () => {
    const tabs = buildCategoryTabs({
      ...tabOptions,
      categoryTags: [createCategoryTag('focus'), createCategoryTag('health')],
      rows: [
        createRow('a', { categoryTagId: 'focus' }),
        createRow('a-1', { categoryTagId: 'health', depth: 1 }),
      ],
    });

    expect(tabs.map((tab) => tab.id)).toEqual([ALL_CATEGORY_TAB_ID, 'focus']);
  });

  it('treats unknown categories as uncategorized root items', () => {
    const tabs = buildCategoryTabs({
      ...tabOptions,
      categoryTags: [createCategoryTag('focus')],
      rows: [
        createRow('a', { categoryTagId: 'focus' }),
        createRow('b', { categoryTagId: 'removed' }),
      ],
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      ALL_CATEGORY_TAB_ID,
      'focus',
      UNCATEGORIZED_CATEGORY_TAB_ID,
    ]);
  });

  it('omits the uncategorized tab when every root item has a category', () => {
    const tabs = buildCategoryTabs({
      ...tabOptions,
      categoryTags: [createCategoryTag('focus')],
      rows: [
        createRow('a', { categoryTagId: 'focus' }),
        createRow('a-1', { depth: 1 }),
      ],
    });

    expect(tabs.map((tab) => tab.id)).toEqual([ALL_CATEGORY_TAB_ID, 'focus']);
  });
});

describe('filterRowsByCategoryTab', () => {
  const categoryTags = [
    createCategoryTag('focus'),
    createCategoryTag('health'),
  ];
  const rows = [
    createRow('a', { categoryTagId: 'focus' }),
    createRow('a-1', { depth: 1 }),
    createRow('a-1-1', { categoryTagId: 'health', depth: 2 }),
    createRow('b', { categoryTagId: 'health' }),
    createRow('c'),
    createRow('c-1', { categoryTagId: 'focus', depth: 1 }),
  ];
  const tabs = buildCategoryTabs({ ...tabOptions, categoryTags, rows });

  it('returns every row on the all tab', () => {
    expect(
      filterRowsByCategoryTab({
        getCategoryTagId: tabOptions.getCategoryTagId,
        activeTabId: ALL_CATEGORY_TAB_ID,
        rows,
        tabs,
      }),
    ).toEqual(rows);
  });

  it('keeps the whole subtree of the root items in the active category', () => {
    expect(
      filterRowsByCategoryTab({
        getCategoryTagId: tabOptions.getCategoryTagId,
        activeTabId: 'focus',
        rows,
        tabs,
      }).map((row) => row.item.id),
    ).toEqual(['a', 'a-1', 'a-1-1']);
  });

  it('groups root items without a known category under the uncategorized tab', () => {
    expect(
      filterRowsByCategoryTab({
        getCategoryTagId: tabOptions.getCategoryTagId,
        activeTabId: UNCATEGORIZED_CATEGORY_TAB_ID,
        rows,
        tabs,
      }).map((row) => row.item.id),
    ).toEqual(['c', 'c-1']);
  });
});

describe('resolveActiveCategoryTab', () => {
  const tabs = buildCategoryTabs({
    ...tabOptions,
    categoryTags: [createCategoryTag('focus')],
    rows: [createRow('a', { categoryTagId: 'focus' }), createRow('b')],
  });

  it('resolves the requested tab when it still exists', () => {
    expect(resolveActiveCategoryTab(tabs, 'focus')?.id).toBe('focus');
  });

  it('falls back to the all tab when the requested tab is gone', () => {
    expect(resolveActiveCategoryTab(tabs, 'health')?.id).toBe(
      ALL_CATEGORY_TAB_ID,
    );
  });

  it('returns null without tabs', () => {
    expect(resolveActiveCategoryTab([], 'focus')).toBeNull();
  });
});
