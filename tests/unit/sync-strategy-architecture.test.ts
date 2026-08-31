import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('authenticated sync strategy architecture', () => {
  it('ships only the account outbox implementation', () => {
    const packageManifest = JSON.parse(readRepositoryFile('package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageManifest.dependencies).not.toHaveProperty('@powersync/web');
    expect(existsSync(resolve(repositoryRoot, 'src/lib/powersync'))).toBe(
      false,
    );
    expect(
      existsSync(resolve(repositoryRoot, 'src/features/powersync-poc')),
    ).toBe(false);
    expect(existsSync(resolve(repositoryRoot, 'src/app/~powersync-poc'))).toBe(
      false,
    );
    expect(existsSync(resolve(repositoryRoot, 'powersync'))).toBe(false);
    expect(readRepositoryFile('.env.example')).not.toMatch(/POWERSYNC/);
    expect(readRepositoryFile('supabase/schemas/tick.sql')).not.toMatch(
      /powersync_poc/,
    );
  });
});
