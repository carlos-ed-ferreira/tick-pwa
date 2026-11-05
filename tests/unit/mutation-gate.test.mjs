import { describe, expect, it } from 'vitest';
import { mutationScores } from '../../scripts/check-mutation.mjs';

describe('mutation ratchet', () => {
  it('counts undetected mutants and excludes invalid mutations', () => {
    const report = {
      files: {
        'domain.ts': {
          mutants: [
            'Killed',
            'Timeout',
            'Survived',
            'NoCoverage',
            'CompileError',
          ].map((status) => ({ status })),
        },
      },
    };
    expect(mutationScores(report)).toEqual({
      total: 50,
      files: { 'domain.ts': 50 },
    });
  });

  it('rejects empty evidence', () => {
    expect(() => mutationScores({ files: {} })).toThrow();
  });
});
