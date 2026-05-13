import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '@/lib/domain';
import { buildVisibleChecklistRows } from '@/features/checklist';

function item(overrides: Partial<ChecklistItem>): ChecklistItem {
  const now = '2026-05-13T12:00:00.000Z';

  return {
    id: overrides.id ?? crypto.randomUUID(),
    scopeId: 'guest:test',
    dailyEntryId: 'day-1',
    parentId: null,
    text: '',
    checked: false,
    collapsed: false,
    colorTagId: null,
    sortRank: 'U',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    remoteRevision: null,
    clientUpdatedAt: now,
    ...overrides,
  };
}

describe('checklist tree', () => {
  it('builds visible rows with depth and sibling ordering', () => {
    const rows = buildVisibleChecklistRows([
      item({ id: 'second', sortRank: 'd' }),
      item({ id: 'first', sortRank: 'U' }),
      item({ id: 'child', parentId: 'first', sortRank: 'U' }),
    ]);

    expect(rows.map((row) => [row.item.id, row.depth])).toEqual([
      ['first', 0],
      ['child', 1],
      ['second', 0],
    ]);
  });

  it('hides descendants of collapsed items', () => {
    const rows = buildVisibleChecklistRows([
      item({ id: 'parent', collapsed: true }),
      item({ id: 'child', parentId: 'parent' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      item: expect.objectContaining({ id: 'parent' }),
      childCount: 1,
      hasChildren: true,
    });
  });
});
