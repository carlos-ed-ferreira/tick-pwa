import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  importCalendarDays,
  createGoal,
  createGoalStep,
  db,
  updateGoalStepText,
} from '@/lib/db';

const { remoteClient } = vi.hoisted(() => ({
  remoteClient: vi.fn(() => {
    throw new Error('Guest must not initialize remote persistence.');
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: remoteClient,
}));

beforeEach(async () => {
  remoteClient.mockClear();
  await db.delete();
  await db.open();
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

it('preserves editable guest tasks and goals after reopening years later without remote persistence', async () => {
  const scope = createGuestScope('permanent-local-access');
  await importCalendarDays({
    scope,
    timezone: 'America/Sao_Paulo',
    days: [
      {
        date: '2026-11-02',
        items: Array.from({ length: 205 }, (_, index) => ({
          id: `local-task-${index}`,
          parentId: null,
          text: `Local task ${index}`,
          scheduledTime: null,
          checked: false,
          ignored: false,
          markLevel: 0,
          bold: false,
          priority: false,
          collapsed: false,
          category: null,
          sortRank: String(index).padStart(4, '0'),
        })),
      },
    ],
  });
  const goal = await createGoal({
    scope,
    category: 'short',
    title: 'Local goal',
  });
  const step = await createGoalStep({
    scope,
    goalId: goal.id,
    text: 'Persistent step',
  });
  db.close();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2036-11-02T12:00:00Z'));
  await db.open();
  await updateGoalStepText({
    scope,
    goalStepId: step.id,
    text: 'Still editable',
  });
  expect(
    await db.checklistItems.where('scopeId').equals(scope.id).count(),
  ).toBe(205);
  expect(await db.goals.get(goal.id)).toMatchObject({
    title: goal.title,
    scopeId: scope.id,
  });
  expect(await db.goalSteps.get(step.id)).toMatchObject({
    text: 'Still editable',
    scopeId: scope.id,
  });
  expect(remoteClient).not.toHaveBeenCalled();
}, 20000);
