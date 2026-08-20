import { describe, expect, it } from 'vitest';
import {
  getNextTaskCompletionValues,
  getSelectionCompletionState,
  getTaskCompletionState,
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

describe('selection completion state', () => {
  it('falls back to unchecked without any selected value', () => {
    expect(getSelectionCompletionState([])).toBe('unchecked');
  });

  it('reports completed only when every selected value is completed', () => {
    expect(
      getSelectionCompletionState([
        { completed: true, ignored: false },
        { completed: true, ignored: false },
      ]),
    ).toBe('completed');
    expect(
      getSelectionCompletionState([
        { completed: true, ignored: false },
        { completed: false, ignored: false },
      ]),
    ).toBe('unchecked');
  });

  it('reports ignored only when every selected value is ignored', () => {
    expect(
      getSelectionCompletionState([
        { completed: false, ignored: true },
        { completed: true, ignored: true },
      ]),
    ).toBe('ignored');
    expect(
      getSelectionCompletionState([
        { completed: false, ignored: true },
        { completed: true, ignored: false },
      ]),
    ).toBe('unchecked');
  });
});
