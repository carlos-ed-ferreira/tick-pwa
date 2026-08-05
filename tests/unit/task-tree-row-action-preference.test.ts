import { describe, expect, it } from 'vitest';
import {
  copyTaskTreeRowActionPreferences,
  defaultTaskTreeRowActionPreferences,
} from '@/components/app';
import {
  ACCOUNT_PREFERENCE_KEYS,
  CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
  getTaskTreeRowActionsPreferenceKey,
  GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY,
  TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
} from '@/lib/supabase/account-preferences';

describe('task tree row action preference keys', () => {
  it('keeps daily task and goal step preferences independent', () => {
    expect(getTaskTreeRowActionsPreferenceKey('checklist_item')).toBe(
      TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
    );
    expect(getTaskTreeRowActionsPreferenceKey('goal_step')).toBe(
      GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY,
    );
    expect(ACCOUNT_PREFERENCE_KEYS).toEqual([
      TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
      GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY,
      CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
    ]);
  });

  it('preserves the target time visibility when copying between surfaces', () => {
    expect(
      copyTaskTreeRowActionPreferences({
        source: {
          ...defaultTaskTreeRowActionPreferences,
          priority: 'hidden',
          scheduledTime: false,
        },
        target: {
          ...defaultTaskTreeRowActionPreferences,
          priority: 'inline',
          scheduledTime: true,
        },
      }),
    ).toEqual({
      ...defaultTaskTreeRowActionPreferences,
      priority: 'hidden',
      scheduledTime: true,
    });
  });
});
