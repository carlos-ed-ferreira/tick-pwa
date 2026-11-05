import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createSyncMetadata,
  getEntitySyncStatus,
  createTimestamp,
} from '@/lib/db/entity-metadata';

describe('entity metadata timestamps', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('separates local guest metadata from pending authenticated metadata', () => {
    const timestamp = '2026-11-03T12:00:00.000Z';
    const guest = createGuestScope('metadata-device');
    const account = createUserScope('metadata-user');
    expect(getEntitySyncStatus(guest)).toBe('local');
    expect(getEntitySyncStatus(account)).toBe('pending');
    expect(createSyncMetadata(account, timestamp)).toEqual({
      syncStatus: 'pending',
      remoteRevision: null,
      clientUpdatedAt: timestamp,
    });
    expect(createSyncMetadata(guest, timestamp)).toEqual({
      syncStatus: 'local',
      remoteRevision: null,
      clientUpdatedAt: timestamp,
    });
  });

  it('creates distinct version tokens for changes in the same millisecond', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00.000Z'));

    const firstTimestamp = createTimestamp();
    const secondTimestamp = createTimestamp();

    expect(secondTimestamp).not.toBe(firstTimestamp);
    expect(secondTimestamp > firstTimestamp).toBe(true);
  });
});
