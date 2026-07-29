import { describe, expect, it } from 'vitest';
import { sortByRank } from '@/lib/domain';
import {
  createBulkChecklistDraftItem,
  moveBulkChecklistDraftItemToParent,
  reorderBulkChecklistDraftItemsByScheduledTime,
  toggleBulkChecklistDraftItemBold,
  updateBulkChecklistDraftItemScheduledTime,
} from '@/features/calendar/bulk-checklist-draft';

describe('moveBulkChecklistDraftItemToParent', () => {
  it('moves a draft under the target and rejects a cycle', () => {
    const roots = createBulkChecklistDraftItem([], {
      id: 'parent',
      text: 'Parent',
    });
    const items = createBulkChecklistDraftItem(roots, {
      id: 'child',
      text: 'Child',
    });

    const nestedItems = moveBulkChecklistDraftItemToParent(
      items,
      'child',
      'parent',
    );
    const cycleAttempt = moveBulkChecklistDraftItemToParent(
      nestedItems,
      'parent',
      'child',
    );

    expect(nestedItems.find((item) => item.id === 'child')?.parentId).toBe(
      'parent',
    );
    expect(cycleAttempt).toEqual(nestedItems);
  });
});

describe('reorderBulkChecklistDraftItemsByScheduledTime', () => {
  it('sorts timed roots while preserving untimed and nested item order', () => {
    let items = createBulkChecklistDraftItem([], {
      id: 'untimed',
      text: 'Untimed',
    });
    items = createBulkChecklistDraftItem(items, {
      id: 'late',
      text: 'Late',
    });
    items = createBulkChecklistDraftItem(items, {
      id: 'early',
      text: 'Early',
    });
    items = createBulkChecklistDraftItem(items, {
      id: 'child',
      parentId: 'late',
      text: 'Nested',
    });
    items = updateBulkChecklistDraftItemScheduledTime(items, 'late', '18:00');
    items = updateBulkChecklistDraftItemScheduledTime(items, 'early', '08:00');

    const sortedItems = reorderBulkChecklistDraftItemsByScheduledTime(items);
    const sortedRoots = sortByRank(
      sortedItems.filter((item) => item.parentId === null),
    );

    expect(sortedRoots.map((item) => item.id)).toEqual([
      'early',
      'late',
      'untimed',
    ]);
    expect(sortedItems.find((item) => item.id === 'child')?.parentId).toBe(
      'late',
    );
  });
});

describe('toggleBulkChecklistDraftItemBold', () => {
  it('keeps bold formatting in the bulk draft', () => {
    const items = createBulkChecklistDraftItem([], {
      id: 'task',
      text: 'Important',
    });

    const boldItems = toggleBulkChecklistDraftItemBold(items, 'task');

    expect(boldItems[0]).toMatchObject({ bold: true });
  });
});
