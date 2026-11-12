import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const initialExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = initialExitCode;
  vi.doUnmock('node:fs/promises');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('documentation link validation', () => {
  it('validates the opened file when its path is replaced during inspection', async () => {
    const target = path.resolve('linked.md');
    let linkedContent = '# Expected heading';
    const close = vi.fn();
    const messages = [];
    const documents = {
      'README.md': '[Linked document](linked.md#expected-heading)',
      'AGENTS.md': '',
      'CLAUDE.md': '',
      'REVIEW.md': '',
    };
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockImplementation((message) => {
      messages.push(String(message));
      return true;
    });
    vi.doMock('node:fs/promises', () => {
      const filesystem = {
        readdir: vi.fn(async () => []),
        readFile: vi.fn(async (file) =>
          file === target ? linkedContent : documents[file],
        ),
        stat: vi.fn(async () => {
          linkedContent = '# Replacement heading';
          return {};
        }),
        open: vi.fn(async () => {
          const openedContent = linkedContent;
          linkedContent = '# Replacement heading';
          return { readFile: vi.fn(async () => openedContent), close };
        }),
      };
      return { ...filesystem, default: filesystem };
    });

    await import('../../scripts/check-docs.mjs');

    expect(messages).toEqual([]);
    expect(process.exitCode).toBe(initialExitCode);
    expect(close).toHaveBeenCalledOnce();
  });
});
