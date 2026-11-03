import { describe, expect, it } from 'vitest';
import { assertSafeSarif } from '../../scripts/check-sarif.mjs';

function report(severity, results = [{ ruleIndex: 0 }]) {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            rules: [
              {
                id: 'security-test',
                properties: { 'security-severity': severity },
              },
            ],
          },
        },
        results,
      },
    ],
  };
}

describe('SAST release gate', () => {
  it('blocks high and critical findings without printing source content', () => {
    expect(() => assertSafeSarif(report('7.0'))).toThrow('security-test');
    expect(() => assertSafeSarif(report('9.8'))).toThrow('security-test');
  });
  it('accepts a clean result and records lower severity separately', () => {
    expect(() => assertSafeSarif(report('9.8', []))).not.toThrow();
    expect(() => assertSafeSarif(report('5.0'))).not.toThrow();
  });
  it('fails closed on a missing or malformed report', () => {
    expect(() => assertSafeSarif({})).toThrow();
    expect(() => assertSafeSarif(report('not-a-number'))).toThrow();
  });
});
