import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  createChecklistItem,
  createGoal,
  createGoalStep,
  db,
  openOrCreateDailyEntry,
  toggleGoalStepChecked,
  updateChecklistItemText,
  updateGoalStepText,
} from '@/lib/db';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

function createAccountWriteClient() {
  let revision = 0;

  return {
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { revision: (revision += 1) },
            error: null,
          }),
        })),
      })),
    })),
  };
}

describe('scope isolation', () => {
  beforeEach(async () => {
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      createAccountWriteClient(),
    );
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    supabaseMocks.getSupabaseBrowserClient.mockReset();
    await db.delete();
  });

  it('keeps daily checklist data isolated between guest scopes', async () => {
    const firstScope = createGuestScope('first-device');
    const secondScope = createGuestScope('second-device');
    const firstEntry = await openOrCreateDailyEntry({
      scope: firstScope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const secondEntry = await openOrCreateDailyEntry({
      scope: secondScope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const firstItem = await createChecklistItem({
      scope: firstScope,
      dailyEntryId: firstEntry.id,
      text: 'First scope task',
    });
    const secondItem = await createChecklistItem({
      scope: secondScope,
      dailyEntryId: secondEntry.id,
      text: 'Second scope task',
    });

    await updateChecklistItemText({
      scope: secondScope,
      itemId: firstItem.id,
      text: 'Cross-scope edit',
    });
    await updateChecklistItemText({
      scope: firstScope,
      itemId: secondItem.id,
      text: 'Another cross-scope edit',
    });

    await expect(db.checklistItems.get(firstItem.id)).resolves.toMatchObject({
      scopeId: firstScope.id,
      text: 'First scope task',
    });
    await expect(db.checklistItems.get(secondItem.id)).resolves.toMatchObject({
      scopeId: secondScope.id,
      text: 'Second scope task',
    });
  });

  it('keeps goal steps isolated between authenticated user scopes', async () => {
    const firstScope = createUserScope('first-user');
    const secondScope = createUserScope('second-user');
    const firstGoal = await createGoal({
      scope: firstScope,
      category: 'short',
      title: 'First user goal',
    });
    const secondGoal = await createGoal({
      scope: secondScope,
      category: 'short',
      title: 'Second user goal',
    });
    const firstStep = await createGoalStep({
      scope: firstScope,
      goalId: firstGoal.id,
      text: 'First user step',
    });
    const secondStep = await createGoalStep({
      scope: secondScope,
      goalId: secondGoal.id,
      text: 'Second user step',
    });

    await updateGoalStepText({
      scope: secondScope,
      goalStepId: firstStep.id,
      text: 'Cross-user edit',
    });
    await toggleGoalStepChecked({
      scope: firstScope,
      goalStepId: secondStep.id,
    });

    await expect(db.goalSteps.get(firstStep.id)).resolves.toMatchObject({
      completed: false,
      scopeId: firstScope.id,
      text: 'First user step',
    });
    await expect(db.goalSteps.get(secondStep.id)).resolves.toMatchObject({
      completed: false,
      scopeId: secondScope.id,
      text: 'Second user step',
    });
  });
});
