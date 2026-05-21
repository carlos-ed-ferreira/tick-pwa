import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createCategoryTag,
  createChecklistItem,
  createGoal,
  createGoalStep,
  db,
  openOrCreateDailyEntry,
} from '@/lib/db';

describe('sync outbox boundaries', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('keeps guest writes local and out of the sync outbox', async () => {
    const scope = createGuestScope('local-only');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Local item',
    });
    const categoryTag = await createCategoryTag({
      scope,
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const goal = await createGoal({
      scope,
      category: 'short',
      title: 'Local goal',
    });
    const goalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Local goal step',
    });

    await expect(db.syncOutbox.count()).resolves.toBe(0);
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
    await expect(db.goalSteps.get(goalStep.id)).resolves.toMatchObject({
      syncStatus: 'local',
    });
  });

  it('queues authenticated writes for sync with pending metadata', async () => {
    const scope = createUserScope('cloud-user');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Cloud item',
    });
    const categoryTag = await createCategoryTag({
      scope,
      name: 'Focus',
      colorHex: '#2563eb',
    });
    const goal = await createGoal({
      scope,
      category: 'short',
      title: 'Cloud goal',
    });
    const goalStep = await createGoalStep({
      scope,
      goalId: goal.id,
      text: 'Cloud goal step',
    });
    const outboxItems = await db.syncOutbox
      .where('scopeId')
      .equals(scope.id)
      .toArray();

    expect(outboxItems.map((outboxItem) => outboxItem.entityType)).toEqual(
      expect.arrayContaining([
        'dailyEntry',
        'checklistItem',
        'categoryTag',
        'goal',
        'goalStep',
      ]),
    );
    expect(
      outboxItems.every((outboxItem) => outboxItem.status === 'pending'),
    ).toBe(true);
    expect(
      outboxItems.every((outboxItem) => outboxItem.scopeId === scope.id),
    ).toBe(true);
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });
    await expect(db.categoryTags.get(categoryTag.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });
    await expect(db.goals.get(goal.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });
    await expect(db.goalSteps.get(goalStep.id)).resolves.toMatchObject({
      syncStatus: 'pending',
    });
  });
});
