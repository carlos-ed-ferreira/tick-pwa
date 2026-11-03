import { describe, expect, it } from 'vitest';
import {
  analyzeSource,
  compareQuality,
  findCycleEdges,
} from '../../scripts/check-quality.mjs';

describe('structural and architecture gates', () => {
  it('rejects relative and package imports that cross the domain boundary', () => {
    const source =
      "import { db } from '../db/database';\nimport { createClient } from '@supabase/supabase-js';\nimport React from 'react';";
    expect(
      analyzeSource(source, 'src/lib/domain/example.ts').forbidden,
    ).toHaveLength(3);
  });
  it('rejects a new complex function while allowing unchanged legacy complexity', () => {
    const complex = `export function legacy(x) { ${Array.from({ length: 11 }, () => 'if(x) x--;').join('')} }`;
    const original = analyzeSource(complex, 'src/lib/domain/example.ts');
    expect(
      compareQuality(
        { files: { example: original }, cycles: [] },
        { files: { example: original }, cycles: [] },
      ),
    ).toEqual([]);
    const changed = analyzeSource(
      `${complex}\n${complex.replace('legacy', 'added')}`,
      'src/lib/domain/example.ts',
    );
    expect(
      compareQuality(
        { files: { example: changed }, cycles: [] },
        { files: { example: original }, cycles: [] },
      ).join(' '),
    ).toContain('added');
  });

  it('rejects growth of a legacy module and a new function above the line limit', () => {
    const previous = analyzeSource(
      Array.from(
        { length: 810 },
        (_, index) => `const value${index} = 0;`,
      ).join('\n'),
      'src/example.ts',
    );
    const changed = analyzeSource(
      `${'\n'.repeat(10)}${Array.from({ length: 811 }, (_, index) => `const value${index} = 0;`).join('\n')}`,
      'src/example.ts',
    );
    expect(
      compareQuality(
        { files: { example: changed }, cycles: [] },
        { files: { example: previous }, cycles: [] },
      ).length,
    ).toBeGreaterThan(0);
    const long = analyzeSource(
      `function oversized() {\n${'value();\n'.repeat(81)}}`,
      'src/new.ts',
    );
    expect(
      compareQuality(
        { files: { new: long }, cycles: [] },
        { files: {}, cycles: [] },
      ).join(' '),
    ).toContain('oversized');
  });

  it('finds new cycles and prohibited domain dependencies', () => {
    expect(
      findCycleEdges(
        new Map([
          ['a', ['b']],
          ['b', ['a']],
          ['c', []],
        ]),
      ),
    ).toEqual(['a -> b', 'b -> a']);
    const file = analyzeSource(
      "import { db } from '@/lib/db';",
      'src/lib/domain/example.ts',
    );
    expect(
      compareQuality(
        { files: { domain: file }, cycles: ['a -> b'] },
        { files: {}, cycles: [] },
      ).join(' '),
    ).toMatch(/domain|cycle/);
  });
});
