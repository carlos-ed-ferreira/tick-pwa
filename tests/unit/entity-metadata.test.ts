import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTimestamp } from '@/lib/db/entity-metadata';

describe('entity metadata timestamps', () => {
  afterEach(() => {
    vi.useRealTimers();
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
