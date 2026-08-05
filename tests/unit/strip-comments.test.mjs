import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  processCodeComments,
  stripFileComments,
} from '../../scripts/strip-comments.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('strip-comments', () => {
  it('removes TypeScript comments without changing comment-like literals', () => {
    const source = [
      "const url = 'https://tick.test/path';",
      'const expression = /https?:\\/\\//;',
      'const template = `value // kept ${value /* removed */}`;',
      'const value = 1; // removed',
      '/* removed too */',
      '',
    ].join('\n');

    expect(stripFileComments('example.ts', source)).toBe(
      [
        "const url = 'https://tick.test/path';",
        'const expression = /https?:\\/\\//;',
        'const template = `value // kept ${value  }`;',
        'const value = 1;  ',
        ' ',
        '',
      ].join('\n'),
    );
  });

  it('removes CSS and SQL comments while preserving quoted content', () => {
    expect(
      stripFileComments(
        'example.css',
        '.icon { content: "/* kept */"; } /* removed */\n',
      ),
    ).toBe('.icon { content: "/* kept */"; }  \n');

    expect(
      stripFileComments(
        'example.sql',
        "select '-- kept', $$/* kept */$$; -- removed\n/* removed */\n",
      ),
    ).toBe("select '-- kept', $$/* kept */$$;  \n \n");
  });

  it('finds comments between punctuation and inside JSX', () => {
    const source = [
      'const empty = { /* removed */ };',
      'const view = <div>{/* removed */}<span data-value="// kept" /></div>;',
      '',
    ].join('\n');

    expect(stripFileComments('example.tsx', source)).toBe(
      [
        'const empty = {   };',
        'const view = <div>{ }<span data-value="// kept" /></div>;',
        '',
      ].join('\n'),
    );
  });

  it('checks and removes comments while ignoring generated files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tick-comments-'));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'public'), { recursive: true });
    await writeFile(
      path.join(root, 'src', 'example.ts'),
      'const value = 1; // remove\n',
    );
    await writeFile(path.join(root, 'next-env.d.ts'), '/// generated\n');
    await writeFile(path.join(root, 'public', 'sw.js'), '/* generated */\n');

    await expect(processCodeComments(root, { write: false })).resolves.toEqual([
      'src/example.ts',
    ]);
    await expect(
      readFile(path.join(root, 'src', 'example.ts'), 'utf8'),
    ).resolves.toContain('// remove');

    await expect(processCodeComments(root, { write: true })).resolves.toEqual([
      'src/example.ts',
    ]);
    await expect(
      readFile(path.join(root, 'src', 'example.ts'), 'utf8'),
    ).resolves.toBe('const value = 1;  \n');
  });
});
