import { describe, expect, it } from 'vitest';
import {
  compareSortRanks,
  createInitialSortRank,
  createRankAfter,
  createReorderedRank,
  createSortRankBetween,
  sortByRank,
} from '@/lib/domain';

describe('sort ranks', () => {
  it('creates a rank between two adjacent bounds', () => {
    const rank = createSortRankBetween('U', 'W');

    expect(compareSortRanks('U', rank)).toBeLessThan(0);
    expect(compareSortRanks(rank, 'W')).toBeLessThan(0);
  });

  it('creates appendable ranks', () => {
    const firstRank = createInitialSortRank();
    const secondRank = createSortRankBetween(firstRank, null);

    expect(compareSortRanks(firstRank, secondRank)).toBeLessThan(0);
  });

  it('sorts ranked items without mutating the original array', () => {
    const items = [
      { id: 'third', sortRank: 'n' },
      { id: 'first', sortRank: 'U' },
      { id: 'second', sortRank: 'd' },
    ];

    expect(sortByRank(items).map((item) => item.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(items.map((item) => item.id)).toEqual(['third', 'first', 'second']);
  });

  it('creates insertion ranks after a sibling', () => {
    const items = [
      { id: 'first', sortRank: 'U' },
      { id: 'second', sortRank: 'n' },
    ];
    const rank = createRankAfter({ items, afterItemId: 'first' });

    expect(compareSortRanks('U', rank)).toBeLessThan(0);
    expect(compareSortRanks(rank, 'n')).toBeLessThan(0);
  });

  it('creates append ranks when no sibling is provided', () => {
    const items = [
      { id: 'first', sortRank: 'U' },
      { id: 'second', sortRank: 'd' },
    ];
    const rank = createRankAfter({ items });

    expect(compareSortRanks('d', rank)).toBeLessThan(0);
  });

  it('creates reordered ranks for adjacent movement', () => {
    const items = [
      { id: 'first', sortRank: 'U' },
      { id: 'second', sortRank: 'd' },
      { id: 'third', sortRank: 'n' },
    ];
    const rank = createReorderedRank({
      items,
      itemId: 'third',
      direction: 'up',
    });

    expect(rank).not.toBeNull();
    expect(compareSortRanks('U', rank ?? '')).toBeLessThan(0);
    expect(compareSortRanks(rank ?? '', 'd')).toBeLessThan(0);
  });

  it('returns null for impossible reorders', () => {
    const items = [
      { id: 'first', sortRank: 'U' },
      { id: 'second', sortRank: 'd' },
    ];

    expect(
      createReorderedRank({ items, itemId: 'first', direction: 'up' }),
    ).toBeNull();
    expect(
      createReorderedRank({ items, itemId: 'missing', direction: 'down' }),
    ).toBeNull();
  });
});
