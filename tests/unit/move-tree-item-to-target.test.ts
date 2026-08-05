import { describe, expect, it, vi } from 'vitest';
import { moveTreeItemToTarget } from '@/components/app/move-tree-item-to-target';

const items = [
  { id: 'first', parentId: null },
  { id: 'second', parentId: null },
  { id: 'child', parentId: 'first' },
];

describe('moveTreeItemToTarget', () => {
  it('moves across siblings one persisted step at a time', async () => {
    const onReorder = vi.fn().mockResolvedValue(undefined);

    await moveTreeItemToTarget({
      itemId: 'first',
      items,
      placement: 'after',
      targetItemId: 'second',
      onReorder,
    });

    expect(onReorder).toHaveBeenCalledWith('first', 'down');
  });

  it('places the item beside a sibling target in a single move when supported', async () => {
    const onMoveAdjacent = vi.fn().mockResolvedValue(undefined);
    const onReorder = vi.fn().mockResolvedValue(undefined);

    await moveTreeItemToTarget({
      itemId: 'first',
      items,
      placement: 'after',
      targetItemId: 'second',
      onMoveAdjacent,
      onReorder,
    });

    expect(onMoveAdjacent).toHaveBeenCalledWith('first', 'second', 'after');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('keeps an item in place when the target position is the current one', async () => {
    const onMoveAdjacent = vi.fn().mockResolvedValue(undefined);

    await moveTreeItemToTarget({
      itemId: 'second',
      items,
      placement: 'after',
      targetItemId: 'first',
      onMoveAdjacent,
      onReorder: vi.fn(),
    });

    expect(onMoveAdjacent).not.toHaveBeenCalled();
  });

  it('does not move across parents or non-persisted items', async () => {
    const onReorder = vi.fn();

    await moveTreeItemToTarget({
      itemId: 'child',
      items,
      placement: 'before',
      targetItemId: 'first',
      onReorder,
    });
    await moveTreeItemToTarget({
      itemId: 'first',
      items,
      placement: 'after',
      targetItemId: 'second',
      canMove: (item) => item.id !== 'first',
      onReorder,
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('moves an item into the target as its child without allowing cycles', async () => {
    const onMoveAsChild = vi.fn().mockResolvedValue(undefined);

    await moveTreeItemToTarget({
      itemId: 'second',
      items,
      placement: 'child',
      targetItemId: 'first',
      onMoveAsChild,
      onReorder: vi.fn(),
    });
    await moveTreeItemToTarget({
      itemId: 'first',
      items,
      placement: 'child',
      targetItemId: 'child',
      onMoveAsChild,
      onReorder: vi.fn(),
    });

    expect(onMoveAsChild).toHaveBeenCalledOnce();
    expect(onMoveAsChild).toHaveBeenCalledWith('second', 'first');
  });

  it('moves an item beside a target in a different hierarchy', async () => {
    const onMoveAdjacent = vi.fn().mockResolvedValue(undefined);

    await moveTreeItemToTarget({
      itemId: 'child',
      items,
      placement: 'after',
      targetItemId: 'second',
      onMoveAdjacent,
      onReorder: vi.fn(),
    });

    expect(onMoveAdjacent).toHaveBeenCalledWith('child', 'second', 'after');
  });
});
