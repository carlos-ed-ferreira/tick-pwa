import { describe, expect, it } from 'vitest';
import { createUserScope } from '@/lib/domain';
import {
  categoryTagFromRemote,
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
});
