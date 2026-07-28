import { describe, expect, it } from 'vitest';
import {
  getTaskCompletionState,
  getNextTaskCompletionValues,
} from '@/lib/domain';

describe('task completion state', () => {
  it('cycles from unchecked to completed, ignored, and unchecked again', () => {
    expect(getTaskCompletionState(false, false)).toBe('unchecked');
    expect(getNextTaskCompletionValues(false, false)).toEqual({
      completed: true,
      ignored: false,
    });
    expect(getNextTaskCompletionValues(true, false)).toEqual({
      completed: false,
      ignored: true,
    });
    expect(getNextTaskCompletionValues(false, true)).toEqual({
      completed: false,
      ignored: false,
    });
  });

  it('treats ignored as authoritative over inconsistent completed data', () => {
    expect(getTaskCompletionState(true, true)).toBe('ignored');
  });
});
