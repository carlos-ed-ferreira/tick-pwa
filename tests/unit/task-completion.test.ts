import { describe, expect, it } from 'vitest';
import {
  defaultTaskCompletionSettings,
  getNextTaskCompletionValues,
  getSelectionCompletionValues,
  getTaskCompletionDisplayLevel,
  getTaskCompletionOptions,
  getTaskCompletionState,
  normalizeTaskCompletionSettings,
} from '@/lib/domain';

const uncheckedValues = { completed: false, ignored: false, markLevel: 0 };

describe('task completion settings', () => {
  it('defaults to a single marking level without extra states', () => {
    expect(defaultTaskCompletionSettings).toEqual({
      ignored: false,
      levels: 1,
    });
    expect(normalizeTaskCompletionSettings(null)).toEqual(
      defaultTaskCompletionSettings,
    );
    expect(
      normalizeTaskCompletionSettings({ ignored: true, levels: 3 }),
    ).toEqual({ ignored: true, levels: 3 });
  });

  it('clamps stored levels to the supported range', () => {
    expect(normalizeTaskCompletionSettings({ levels: 0 })).toMatchObject({
      levels: 1,
    });
    expect(normalizeTaskCompletionSettings({ levels: 9 })).toMatchObject({
      levels: 5,
    });
  });
});

describe('task completion cycle', () => {
  it('cycles between unchecked and completed by default', () => {
    const completed = getNextTaskCompletionValues(
      uncheckedValues,
      defaultTaskCompletionSettings,
    );

    expect(completed).toEqual({
      completed: true,
      ignored: false,
      markLevel: 1,
    });
    expect(
      getNextTaskCompletionValues(completed, defaultTaskCompletionSettings),
    ).toEqual(uncheckedValues);
  });

  it('appends the ignored state after the last level when enabled', () => {
    const settings = { ignored: true, levels: 1 };
    const completed = getNextTaskCompletionValues(uncheckedValues, settings);
    const ignored = getNextTaskCompletionValues(completed, settings);

    expect(ignored).toEqual({
      completed: false,
      ignored: true,
      markLevel: 0,
    });
    expect(getNextTaskCompletionValues(ignored, settings)).toEqual(
      uncheckedValues,
    );
  });

  it('walks every marking level and counts each of them as completed', () => {
    const settings = { ignored: false, levels: 3 };
    const levels = [1, 2, 3].map((level) => ({
      completed: true,
      ignored: false,
      markLevel: level,
    }));

    expect(getNextTaskCompletionValues(uncheckedValues, settings)).toEqual(
      levels[0],
    );
    expect(getNextTaskCompletionValues(levels[0], settings)).toEqual(levels[1]);
    expect(getNextTaskCompletionValues(levels[1], settings)).toEqual(levels[2]);
    expect(getNextTaskCompletionValues(levels[2], settings)).toEqual(
      uncheckedValues,
    );
    expect(getTaskCompletionState(levels[0])).toBe('completed');
  });

  it('leaves levels above the configured scale on the next click', () => {
    const settings = { ignored: false, levels: 3 };

    expect(
      getNextTaskCompletionValues(
        { completed: true, ignored: false, markLevel: 5 },
        settings,
      ),
    ).toEqual(uncheckedValues);
  });
});

describe('task completion state', () => {
  it('treats ignored as authoritative over inconsistent completed data', () => {
    expect(
      getTaskCompletionState({
        completed: true,
        ignored: true,
        markLevel: 2,
      }),
    ).toBe('ignored');
  });

  it('reads completed tasks without a stored level as the first level', () => {
    expect(getTaskCompletionState({ completed: true })).toBe('completed');
    expect(
      getTaskCompletionDisplayLevel(
        { completed: true },
        { ignored: false, levels: 3 },
      ),
    ).toBe(1);
  });

  it('displays levels clamped to the configured scale', () => {
    expect(
      getTaskCompletionDisplayLevel(
        { completed: true, ignored: false, markLevel: 5 },
        { ignored: false, levels: 3 },
      ),
    ).toBe(3);
    expect(
      getTaskCompletionDisplayLevel(uncheckedValues, {
        ignored: false,
        levels: 3,
      }),
    ).toBe(0);
  });
});

describe('task completion options', () => {
  it('lists only unchecked and completed by default', () => {
    expect(getTaskCompletionOptions(defaultTaskCompletionSettings)).toEqual([
      uncheckedValues,
      { completed: true, ignored: false, markLevel: 1 },
    ]);
  });

  it('lists every level in order and ends with ignored when enabled', () => {
    expect(getTaskCompletionOptions({ ignored: true, levels: 2 })).toEqual([
      uncheckedValues,
      { completed: true, ignored: false, markLevel: 1 },
      { completed: true, ignored: false, markLevel: 2 },
      { completed: false, ignored: true, markLevel: 0 },
    ]);
  });
});

describe('selection completion values', () => {
  it('falls back to unchecked without any selected value', () => {
    expect(getSelectionCompletionValues([])).toEqual(uncheckedValues);
  });

  it('reports the shared value only when every selection agrees', () => {
    expect(
      getSelectionCompletionValues([
        { completed: true, ignored: false, markLevel: 2 },
        { completed: true, ignored: false, markLevel: 2 },
      ]),
    ).toEqual({ completed: true, ignored: false, markLevel: 2 });
    expect(
      getSelectionCompletionValues([
        { completed: true, ignored: false, markLevel: 2 },
        { completed: true, ignored: false, markLevel: 1 },
      ]),
    ).toEqual(uncheckedValues);
    expect(
      getSelectionCompletionValues([
        { completed: false, ignored: true, markLevel: 0 },
        { completed: false, ignored: true, markLevel: 0 },
      ]),
    ).toEqual({ completed: false, ignored: true, markLevel: 0 });
  });
});
