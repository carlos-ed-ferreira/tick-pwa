import { describe, expect, it } from 'vitest';
import { buildVisibleTreeRows, type ChecklistItem } from '@/lib/domain';
import {
  buildVisibleChecklistRows,
  collectChecklistSubtreeRowIds,
} from '@/features/checklist';

function item(overrides: Partial<ChecklistItem>): ChecklistItem {
  const now = '2026-05-13T12:00:00.000Z';

  return {
    id: overrides.id ?? crypto.randomUUID(),
    scopeId: 'guest:test',
    dailyEntryId: 'day-1',
    parentId: null,
    text: '',
    scheduledTime: null,
    checked: false,
    ignored: false,
    markLevel: 0,
    bold: false,
    priority: false,
    collapsed: false,
    categoryTagId: null,
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

  it('builds generic visible tree rows while skipping deleted items', () => {
    const rows = buildVisibleTreeRows([
      item({ id: 'deleted', deletedAt: '2026-05-13T13:00:00.000Z' }),
      item({ id: 'parent', sortRank: 'U' }),
      item({ id: 'child', parentId: 'parent', sortRank: 'U' }),
    ]);

    expect(rows.map((row) => [row.item.id, row.depth])).toEqual([
      ['parent', 0],
      ['child', 1],
    ]);
  });
});

describe('collectChecklistSubtreeRowIds', () => {
  const rows = [
    { depth: 0, item: { id: 'root', parentId: null } },
    { depth: 1, item: { id: 'child', parentId: 'root' } },
    { depth: 2, item: { id: 'grandchild', parentId: 'child' } },
    { depth: 1, item: { id: 'unrelated', parentId: 'other-root' } },
    { depth: 0, item: { id: 'sibling', parentId: null } },
  ];

  it('collects only descendants linked by parentId', () => {
    expect([...collectChecklistSubtreeRowIds(rows, 'root')]).toEqual([
      'root',
      'child',
      'grandchild',
    ]);
  });

  it('collects descendants that are not contiguous in the row order', () => {
    const scattered = [
      { depth: 0, item: { id: 'root', parentId: null } },
      { depth: 0, item: { id: 'sibling', parentId: null } },
      { depth: 1, item: { id: 'child', parentId: 'root' } },
    ];

    expect([...collectChecklistSubtreeRowIds(scattered, 'root')]).toEqual([
      'root',
      'child',
    ]);
  });

  it('returns the item itself when it is missing from the rows', () => {
    expect([...collectChecklistSubtreeRowIds(rows, 'absent')]).toEqual([
      'absent',
    ]);
  });
});
