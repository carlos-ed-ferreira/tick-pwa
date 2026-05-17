import { describe, expect, it } from 'vitest';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';

describe('requiresDeleteConfirmation', () => {
  it('returns false when content is empty', () => {
    expect(requiresDeleteConfirmation('   ')).toBe(false);
  });

  it('returns true when content exists', () => {
    expect(requiresDeleteConfirmation('Keep me')).toBe(true);
  });
});
