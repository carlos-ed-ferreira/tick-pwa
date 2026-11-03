import { describe, expect, it } from 'vitest';
import {
  compareCoverage,
  changedCoverage,
} from '../../scripts/check-coverage.mjs';

describe('coverage ratchet', () => {
  it('rejects a global regression and accepts improvement toward the goal', () => {
    expect(
      compareCoverage(
        { lines: 74, branches: 67 },
        { lines: 74.5, branches: 67 },
      ).length,
    ).toBe(1);
    expect(
      compareCoverage(
        { lines: 80, branches: 70 },
        { lines: 74.5, branches: 67 },
      ),
    ).toEqual([]);
  });
  it('counts uncovered executable changes and all branch alternatives on changed lines', () => {
    const file = {
      statementMap: { a: { start: { line: 2 } }, b: { start: { line: 3 } } },
      s: { a: 1, b: 0 },
      branchMap: {
        c: {
          line: 2,
          locations: [{ start: { line: 2 } }, { start: { line: 2 } }],
        },
      },
      b: { c: [1, 0] },
    };
    expect(changedCoverage(file, new Set([2, 3]))).toEqual({
      coveredLines: 1,
      totalLines: 2,
      coveredBranches: 1,
      totalBranches: 2,
    });
  });
});
