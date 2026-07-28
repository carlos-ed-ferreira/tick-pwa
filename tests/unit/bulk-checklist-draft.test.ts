import { describe, expect, it } from 'vitest';
import {
  createBulkChecklistDraftItem,
  moveBulkChecklistDraftItemToParent,
  toggleBulkChecklistDraftItemBold,
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
