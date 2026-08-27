import { describe, expect, it } from 'vitest';
import {
  resolveTreeDropPlacement,
  validateTreeDrop,
} from '@/components/app/tree-touch-drag';

describe('resolveTreeDropPlacement', () => {
  it('drops before when the pointer is in the top quarter', () => {
    expect(
      resolveTreeDropPlacement({
        offsetY: 5,
        height: 100,
        isLastSibling: false,
      }),
    ).toBe('before');
  });

  it('drops as child in the middle band', () => {
    expect(
      resolveTreeDropPlacement({
        offsetY: 50,
        height: 100,
        isLastSibling: false,
      }),
    ).toBe('child');
  });

  it('keeps the child placement in the bottom quarter when it is not the last sibling', () => {
    expect(
      resolveTreeDropPlacement({
        offsetY: 90,
        height: 100,
        isLastSibling: false,
      }),
    ).toBe('child');
  });

  it('drops after in the bottom quarter of the last sibling', () => {
    expect(
      resolveTreeDropPlacement({
        offsetY: 90,
        height: 100,
        isLastSibling: true,
      }),
    ).toBe('after');
  });

  it('falls back to after when the row has no measurable height', () => {
    expect(
      resolveTreeDropPlacement({ offsetY: 0, height: 0, isLastSibling: false }),
    ).toBe('after');
  });
});

describe('validateTreeDrop', () => {
  const dragged = {
    itemId: 'dragged',
    parentId: 'parent',
    nextSiblingId: 'next',
    previousSiblingId: 'previous',
  };

  it('rejects dropping an item on itself', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: 'child',
        target: { itemId: 'dragged', parentId: 'parent' },
      }),
    ).toBeNull();
  });

  it('rejects nesting an item into its current parent', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: 'child',
        target: { itemId: 'parent', parentId: null },
      }),
    ).toBeNull();
  });

  it('rejects a no-op move before the next sibling', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: 'before',
        target: { itemId: 'next', parentId: 'parent' },
      }),
    ).toBeNull();
  });

  it('rejects a no-op move after the previous sibling', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: 'after',
        target: { itemId: 'previous', parentId: 'parent' },
      }),
    ).toBeNull();
  });

  it('allows moving before the next sibling of a different parent', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: 'before',
        target: { itemId: 'next', parentId: 'other-parent' },
      }),
    ).toBe('before');
  });

  it('allows a regular reparenting drop', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: 'child',
        target: { itemId: 'other', parentId: 'other-parent' },
      }),
    ).toBe('child');
  });

  it('rejects when there is no placement', () => {
    expect(
      validateTreeDrop({
        dragged,
        placement: null,
        target: { itemId: 'other', parentId: null },
      }),
    ).toBeNull();
  });
});
