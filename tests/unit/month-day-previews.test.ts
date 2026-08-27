import { describe, expect, it } from 'vitest';
import { summarizeDayItems } from '@/features/calendar/use-month-day-previews';
import type { ChecklistItem } from '@/lib/domain';

function item(overrides: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'item-1',
    scopeId: 'guest:test',
    dailyEntryId: 'entry-1',
    parentId: null,
    text: 'Task',
    scheduledTime: null,
    checked: false,
    ignored: false,
    bold: false,
    priority: false,
    collapsed: false,
    categoryTagId: null,
    sortRank: 'a0',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    clientUpdatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as ChecklistItem;
}

describe('summarizeDayItems', () => {
  it('lists every distinct category of the day in sort order', () => {
    const previews = summarizeDayItems([
      item({ id: 'item-3', categoryTagId: 'category-3', sortRank: 'a2' }),
      item({ id: 'item-1', categoryTagId: 'category-1', sortRank: 'a0' }),
      item({ id: 'item-2', categoryTagId: 'category-2', sortRank: 'a1' }),
      item({ id: 'item-4', categoryTagId: 'category-1', sortRank: 'a3' }),
      item({ id: 'item-5', categoryTagId: null, sortRank: 'a4' }),
    ]);

    expect(previews.get('entry-1')?.categoryTagIds).toEqual([
      'category-1',
      'category-2',
      'category-3',
    ]);
  });

  it('keeps the categories of ignored items in the preview and counts them', () => {
    const previews = summarizeDayItems([
      item({ id: 'item-1', categoryTagId: 'category-1' }),
      item({
        id: 'item-2',
        categoryTagId: 'category-2',
        ignored: true,
        sortRank: 'a1',
      }),
      item({ id: 'item-3', ignored: true, sortRank: 'a2' }),
    ]);
    const preview = previews.get('entry-1');

    expect(preview?.categoryTagIds).toEqual(['category-1', 'category-2']);
    expect(preview?.ignoredCount).toBe(2);
  });

  it('groups the preview by daily entry', () => {
    const previews = summarizeDayItems([
      item({ id: 'item-1', dailyEntryId: 'entry-1', ignored: true }),
      item({
        id: 'item-2',
        dailyEntryId: 'entry-2',
        categoryTagId: 'category-1',
      }),
    ]);

    expect(previews.get('entry-1')).toEqual({
      categoryTagIds: [],
      ignoredCount: 1,
    });
    expect(previews.get('entry-2')).toEqual({
      categoryTagIds: ['category-1'],
      ignoredCount: 0,
    });
  });
});
