import { describe, expect, it } from 'vitest';
import { getDropdownJoinShape } from '@/components/app/dropdown-join-shape';

describe('getDropdownJoinShape', () => {
  it('keeps the shared corners on the panel with enough exposed height', () => {
    expect(getDropdownJoinShape(280, 120)).toBe('main-taller');
    expect(getDropdownJoinShape(120, 280)).toBe('extension-taller');
  });

  it('flattens both sides of the join when neither panel clears a full corner', () => {
    expect(getDropdownJoinShape(200, 200)).toBe('similar');
    expect(getDropdownJoinShape(220, 181)).toBe('similar');
  });
});
