import { describe, expect, it } from 'vitest';
import { isUnchangedCacheVersion } from '@/lib/supabase/account-cache-baseline';

const version = {
  id: 'entity',
  scopeId: 'user:owner',
  clientUpdatedAt: 'first',
  remoteRevision: 1,
  syncStatus: 'synced',
};

describe('cache snapshot eligibility', () => {
  it('accepts only the same previously synchronized version', () => {
    expect(isUnchangedCacheVersion(version, version)).toBe(true);
    expect(isUnchangedCacheVersion(undefined, version)).toBe(false);
  });
  it.each([
    { syncStatus: 'pending' },
    { syncStatus: 'syncing' },
    { syncStatus: 'failed' },
    { clientUpdatedAt: 'newer' },
    { remoteRevision: 2 },
  ])('protects a version that changed independently: %j', (change) => {
    expect(isUnchangedCacheVersion(version, { ...version, ...change })).toBe(
      false,
    );
    expect(isUnchangedCacheVersion({ ...version, ...change }, version)).toBe(
      false,
    );
  });
});
