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

function codeqlReport(severity, results) {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: { name: 'CodeQL' },
          extensions: [
            { name: 'codeql/javascript-all', rules: [] },
            {
              name: 'codeql/javascript-queries',
              rules: [
                { id: 'js/low-impact', properties: {} },
                {
                  id: 'js/security-test',
                  properties: { 'security-severity': severity },
                },
              ],
            },
          ],
        },
        results,
      },
    ],
  };
}

const packRuleReference = {
  ruleId: 'js/security-test',
  rule: { id: 'js/security-test', index: 1, toolComponent: { index: 1 } },
};

describe('SAST release gate', () => {
  it('accepts a CodeQL report that groups rules by pack and has no findings', () => {
    expect(() => assertSafeSarif(codeqlReport('9.8', []))).not.toThrow();
  });
  it('resolves rules grouped by pack to block high findings', () => {
    expect(() =>
      assertSafeSarif(codeqlReport('9.8', [packRuleReference])),
    ).toThrow('js/security-test');
  });
  it('resolves rules grouped by pack to accept lower severity findings', () => {
    expect(() =>
      assertSafeSarif(codeqlReport('5.0', [packRuleReference])),
    ).not.toThrow();
  });
  it('fails closed when a grouped finding points to an unknown rule', () => {
    expect(() =>
      assertSafeSarif(
        codeqlReport('5.0', [
          {
            ruleId: 'js/unknown',
            rule: { id: 'js/unknown', index: 9, toolComponent: { index: 1 } },
          },
        ]),
      ),
    ).toThrow('SARIF result has no rule.');
  });

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
