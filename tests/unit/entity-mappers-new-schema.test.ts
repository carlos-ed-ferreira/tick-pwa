import { describe, expect, it } from 'vitest';
import { createUserScope } from '@/lib/domain';
import {
  categoryTagFromRemote,
  goalFromRemote,
  goalStepFromRemote,
  recurrenceFromRemote,
  recurrenceResponseFromRemote,
  toRemotePayload,
} from '@/lib/supabase/entity-mappers';

const base = {
  scopeId: 'user:user-1' as const,
  createdAt: '2026-06-23T10:00:00.000Z',
  updatedAt: '2026-06-23T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'pending' as const,
  remoteRevision: null,
  clientUpdatedAt: '2026-06-23T10:00:00.000Z',
};

describe('new functional schema payloads', () => {
  const scope = createUserScope('user-1');

  it('does not persist removed daily entry columns', () => {
    const payload = toRemotePayload(scope, 'dailyEntry', {
      ...base,
      id: 'entry-1',
      date: '2026-06-23',
      timezone: 'America/Sao_Paulo',
      title: 'legacy',
      note: 'legacy',
      previewText: 'legacy',
      itemCount: 1,
      completedCount: 0,
      categoryTagIds: [],
      categorySummaries: [],
    });

    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('note');
    expect(payload).not.toHaveProperty('preview_text');
  });

  it('persists goal groups and the reduced goal contract', () => {
    expect(
      toRemotePayload(scope, 'goalGroup', {
        ...base,
        id: 'group-1',
        title: 'HEALTH',
        categoryTagId: null,
        sortRank: 'n',
      }),
    ).toMatchObject({
      id: 'group-1',
      user_id: 'user-1',
      title: 'HEALTH',
      category_tag_id: null,
      sort_rank: 'n',
    });

    const goalPayload = toRemotePayload(scope, 'goal', {
      ...base,
      id: 'goal-1',
      groupId: 'group-1',
      title: 'RUN',
      categoryTagId: null,
      sortRank: 'n',
      completedAt: null,
      category: 'now',
      description: '',
      status: 'active',
      progressMode: 'steps',
      progressValue: 0,
      dueDate: null,
      archivedAt: null,
    });

    expect(goalPayload).toMatchObject({
      group_id: 'group-1',
      title: 'RUN',
      completed_at: null,
    });
    expect(goalPayload).not.toHaveProperty('category');
    expect(goalPayload).not.toHaveProperty('status');
    expect(goalPayload).not.toHaveProperty('progress_mode');
    expect(goalPayload).not.toHaveProperty('archived_at');
  });

  it('round-trips the useOwnName flag for category tags', () => {
    const payload = toRemotePayload(scope, 'categoryTag', {
      ...base,
      id: 'category-1',
      name: '',
      colorHex: '#71717a',
      position: 'n',
      surface: 'goal_group',
      useOwnName: true,
    });

    expect(payload).toMatchObject({
      id: 'category-1',
      name: '',
      color_hex: '#71717a',
      surface: 'goal_group',
      use_own_name: true,
    });

    const categoryTag = categoryTagFromRemote(scope, {
      id: 'category-1',
      user_id: 'user-1',
      created_at: base.createdAt,
      updated_at: base.updatedAt,
      deleted_at: null,
      client_updated_at: base.clientUpdatedAt,
      revision: 1,
      name: '',
      color_hex: '#71717a',
      position: 'n',
      surface: 'goal_group',
      use_own_name: true,
    });

    expect(categoryTag.useOwnName).toBe(true);
  });

  it('persists ignored state for checklist items and goal steps', () => {
    expect(
      toRemotePayload(scope, 'checklistItem', {
        ...base,
        id: 'item-1',
        dailyEntryId: 'entry-1',
        parentId: null,
        text: 'Optional task',
        scheduledTime: null,
        checked: false,
        ignored: true,
        bold: true,
        priority: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: 'n',
      }),
    ).toMatchObject({ checked: false, ignored: true, bold: true });

    expect(
      toRemotePayload(scope, 'goalStep', {
        ...base,
        id: 'step-1',
        goalId: 'goal-1',
        parentId: null,
        text: 'Optional step',
        completed: false,
        ignored: true,
        bold: true,
        priority: false,
        collapsed: false,
        categoryTagId: null,
        sortRank: 'n',
      }),
    ).toMatchObject({ completed: false, ignored: true, bold: true });
  });

  it('round-trips the goal due date and the goal step scheduled date', () => {
    const goalPayload = toRemotePayload(scope, 'goal', {
      ...base,
      id: 'goal-1',
      groupId: null,
      title: 'RUN',
      categoryTagId: null,
      sortRank: 'n',
      completedAt: null,
      category: 'now',
      description: '',
      status: 'active',
      progressMode: 'steps',
      progressValue: 0,
      dueDate: '2026-08-20',
      archivedAt: null,
    });

    expect(goalPayload).toMatchObject({ due_date: '2026-08-20' });

    const goal = goalFromRemote(scope, {
      id: 'goal-1',
      user_id: 'user-1',
      created_at: base.createdAt,
      updated_at: base.updatedAt,
      deleted_at: null,
      client_updated_at: base.clientUpdatedAt,
      revision: 1,
      group_id: null,
      title: 'RUN',
      due_date: '2026-08-20',
      category_tag_id: null,
      sort_rank: 'n',
      completed_at: null,
    });

    expect(goal.dueDate).toBe('2026-08-20');

    const goalStepPayload = toRemotePayload(scope, 'goalStep', {
      ...base,
      id: 'step-1',
      goalId: 'goal-1',
      parentId: null,
      text: 'Optional step',
      completed: false,
      ignored: false,
      bold: false,
      priority: false,
      collapsed: false,
      categoryTagId: null,
      scheduledDate: '2026-08-20',
      sortRank: 'n',
    });

    expect(goalStepPayload).toMatchObject({ scheduled_date: '2026-08-20' });

    const goalStep = goalStepFromRemote(scope, {
      id: 'step-1',
      user_id: 'user-1',
      created_at: base.createdAt,
      updated_at: base.updatedAt,
      deleted_at: null,
      client_updated_at: base.clientUpdatedAt,
      revision: 1,
      goal_id: 'goal-1',
      parent_id: null,
      text: 'Optional step',
      completed: false,
      ignored: false,
      bold: false,
      priority: false,
      collapsed: false,
      category_tag_id: null,
      scheduled_date: '2026-08-20',
      sort_rank: 'n',
    });

    expect(goalStep.scheduledDate).toBe('2026-08-20');
  });

  describe('recurrence quantities', () => {
    const recurrence = {
      ...base,
      id: 'reading',
      text: 'Ler',
      bold: false,
      priority: false,
      categoryTagId: null,
      children: [],
      schedule: [],
      contentHistory: [],
    };
    const response = {
      ...base,
      id: 'rr:user:user-1:reading:2026-11-10:root',
      recurrenceId: 'reading',
      date: '2026-11-10' as const,
      itemId: null,
      status: 'not_done' as const,
    };

    it('always sends the measure key, even without a measure', () => {
      expect(toRemotePayload(scope, 'recurrence', recurrence)).toMatchObject({
        measure: null,
      });
      expect(
        toRemotePayload(scope, 'recurrence', {
          ...recurrence,
          measure: { target: 20, unit: 'páginas' },
        }),
      ).toMatchObject({ measure: { target: 20, unit: 'páginas' } });
    });

    it('always sends the quantity columns of an answer', () => {
      expect(
        toRemotePayload(scope, 'recurrenceResponse', response),
      ).toMatchObject({ quantity: null, target: null, unit: null });
      expect(
        toRemotePayload(scope, 'recurrenceResponse', {
          ...response,
          quantity: { target: 20, unit: 'páginas', value: 5.5 },
        }),
      ).toMatchObject({ quantity: 5.5, target: 20, unit: 'páginas' });
    });

    it('reads numeric columns and ignores malformed measures', () => {
      const row = {
        id: 'reading',
        user_id: 'user-1',
        created_at: base.createdAt,
        updated_at: base.updatedAt,
        deleted_at: null,
        client_updated_at: base.clientUpdatedAt,
        revision: 3,
        category_tag_id: null,
        text: 'Ler',
        bold: false,
        priority: false,
        children: [],
        schedule: [],
        content_history: [],
      };

      expect(
        recurrenceFromRemote(scope, {
          ...row,
          measure: { target: '20', unit: 'páginas' },
        }).measure,
      ).toEqual({ target: 20, unit: 'páginas' });
      expect(
        recurrenceFromRemote(scope, { ...row, measure: { unit: 'x' } }).measure,
      ).toBeNull();
      expect(recurrenceFromRemote(scope, row).measure).toBeNull();

      const answer = {
        ...row,
        id: response.id,
        recurrence_id: 'reading',
        date: '2026-11-10',
        item_id: null,
        status: 'not_done',
      };

      expect(
        recurrenceResponseFromRemote(scope, {
          ...answer,
          quantity: '5.500',
          target: '20.000',
          unit: 'páginas',
        }).quantity,
      ).toEqual({ target: 20, unit: 'páginas', value: 5.5 });
      expect(
        recurrenceResponseFromRemote(scope, {
          ...answer,
          quantity: null,
          target: null,
          unit: null,
        }).quantity,
      ).toBeNull();
      expect(recurrenceResponseFromRemote(scope, answer).quantity).toBeNull();
    });
  });
});
