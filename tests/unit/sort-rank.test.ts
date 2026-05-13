import { describe, expect, it } from 'vitest';
import {
  compareSortRanks,
  createInitialSortRank,
  createSortRankBetween,
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
});
