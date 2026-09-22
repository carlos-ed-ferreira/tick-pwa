import { describe, expect, it } from 'vitest';
import { assertMigrationHistoryIsSynchronized } from '../../scripts/migration-history.mjs';

describe('production migration history', () => {
  it('accepts matching local and remote migration versions', () => {
    const output = `
      LOCAL          │ REMOTE         │ TIME (UTC)
      20260825120000 │ 20260825120000 │ 2026-08-25 12:00:00
      20260828180055 │ 20260828180055 │ 2026-08-28 18:00:55
    `;

    expect(() => assertMigrationHistoryIsSynchronized(output)).not.toThrow();
  });

  it('rejects a migration that exists only in the repository', () => {
    const output = `
      LOCAL          │ REMOTE         │ TIME (UTC)
      20260828180055 │ 20260828180055 │ 2026-08-28 18:00:55
      20260914090000 │                │ 2026-09-14 09:00:00
    `;

    expect(() => assertMigrationHistoryIsSynchronized(output)).toThrow(
      '20260914090000/local-only',
    );
  });

  it('rejects an unexpected migration that exists only in production', () => {
    const output = `
      LOCAL          │ REMOTE         │ TIME (UTC)
                     │ 20260914080000 │ 2026-09-14 08:00:00
      20260828180055 │ 20260828180055 │ 2026-08-28 18:00:55
    `;

    expect(() => assertMigrationHistoryIsSynchronized(output)).toThrow(
      '20260914080000/remote-only',
    );
  });

  it('fails closed when the CLI output cannot be parsed', () => {
    expect(() =>
      assertMigrationHistoryIsSynchronized('Unexpected CLI response'),
    ).toThrow('Could not parse the migration history');
  });
});
