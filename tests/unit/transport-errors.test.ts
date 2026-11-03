import { expect, it } from 'vitest';
import { isTransportUnavailableError } from '@/lib/supabase/transport-errors';

it.each([
  [new TypeError('Failed to fetch'), true],
  [new TypeError('Invalid argument'), false],
  [{ message: 'Network request failed' }, true],
  [{ details: 'Load failed' }, true],
  [{ message: 'Permission denied', code: '42501' }, false],
  [{}, false],
  [null, false],
  ['Failed to fetch', false],
])(
  'classifies transport unavailability without treating permission failures as offline: %o',
  (error, expected) => {
    expect(isTransportUnavailableError(error)).toBe(expected);
  },
);
