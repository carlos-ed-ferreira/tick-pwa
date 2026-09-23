import { describe, expect, it } from 'vitest';
import {
  copyTaskTreeRowActionPreferences,
  defaultTaskTreeRowActionPreferences,
  taskTreeRowPlacementActions,
  touchTaskTreeRowActionPreferences,
} from '@/components/app';
import {
  ACCOUNT_PREFERENCE_KEYS,
  CHECKLIST_COMPLETION_STATES_PREFERENCE_KEY,
  CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
  getCategoryViewModePreferenceKey,
  getCompletionStatesPreferenceKey,
  getTaskTreeRowActionsPreferenceKey,
  GOAL_STEP_COMPLETION_STATES_PREFERENCE_KEY,
  GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY,
  GOAL_STEP_VIEW_MODE_PREFERENCE_KEY,
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
    expect(getCategoryViewModePreferenceKey('checklist_item')).toBe(
      CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
    );
    expect(getCategoryViewModePreferenceKey('goal_step')).toBe(
      GOAL_STEP_VIEW_MODE_PREFERENCE_KEY,
    );
    expect(getCompletionStatesPreferenceKey('checklist_item')).toBe(
      CHECKLIST_COMPLETION_STATES_PREFERENCE_KEY,
    );
    expect(getCompletionStatesPreferenceKey('goal_step')).toBe(
      GOAL_STEP_COMPLETION_STATES_PREFERENCE_KEY,
    );
    expect(ACCOUNT_PREFERENCE_KEYS).toEqual([
      TASK_TREE_ROW_ACTIONS_PREFERENCE_KEY,
      GOAL_STEP_TREE_ROW_ACTIONS_PREFERENCE_KEY,
      CHECKLIST_VIEW_MODE_PREFERENCE_KEY,
      GOAL_STEP_VIEW_MODE_PREFERENCE_KEY,
      CHECKLIST_COMPLETION_STATES_PREFERENCE_KEY,
      GOAL_STEP_COMPLETION_STATES_PREFERENCE_KEY,
    ]);
  });

  it('preserves the target time and date visibility when copying between surfaces', () => {
    expect(
      copyTaskTreeRowActionPreferences({
        source: {
          ...defaultTaskTreeRowActionPreferences,
          priority: 'hidden',
          scheduledTime: false,
          scheduledDate: false,
        },
        target: {
          ...defaultTaskTreeRowActionPreferences,
          priority: 'inline',
          scheduledTime: true,
          scheduledDate: true,
        },
      }),
    ).toEqual({
      ...defaultTaskTreeRowActionPreferences,
      priority: 'hidden',
      scheduledTime: true,
      scheduledDate: true,
    });
  });

  it('defaults the scheduled date field to visible', () => {
    expect(defaultTaskTreeRowActionPreferences.scheduledDate).toBe(true);
  });
});

describe('touchTaskTreeRowActionPreferences', () => {
  it('moves every placement action into the sheet', () => {
    const preferences = touchTaskTreeRowActionPreferences({
      ...defaultTaskTreeRowActionPreferences,
      add: 'inline',
      delete: 'hidden',
      priority: 'inline',
    });

    for (const action of taskTreeRowPlacementActions) {
      expect(preferences[action]).toBe('menu');
    }
  });

  it('never hides an action that the desktop can reach', () => {
    const preferences = touchTaskTreeRowActionPreferences({
      ...defaultTaskTreeRowActionPreferences,
      add: 'hidden',
      bold: 'hidden',
      category: 'hidden',
      clearCategory: 'hidden',
      delete: 'hidden',
      indent: 'hidden',
      moveDown: 'hidden',
      moveUp: 'hidden',
      outdent: 'hidden',
      priority: 'hidden',
    });

    expect(
      taskTreeRowPlacementActions.some(
        (action) => preferences[action] === 'hidden',
      ),
    ).toBe(false);
  });

  it('moves the scheduled time and date out of the row', () => {
    const preferences = touchTaskTreeRowActionPreferences(
      defaultTaskTreeRowActionPreferences,
    );

    expect(preferences.scheduledTime).toBe(false);
    expect(preferences.scheduledDate).toBe(false);
  });

  it('keeps the drag handle preference as the user left it', () => {
    expect(
      touchTaskTreeRowActionPreferences({
        ...defaultTaskTreeRowActionPreferences,
        drag: true,
      }).drag,
    ).toBe(true);
    expect(
      touchTaskTreeRowActionPreferences({
        ...defaultTaskTreeRowActionPreferences,
        drag: false,
      }).drag,
    ).toBe(false);
  });
});
