import type { AppScope } from '@/lib/domain';
import { db } from '@/lib/db/database';
import { getSupabaseBrowserClient } from './client';
import {
  categoryTagFromRemote,
  checklistItemFromRemote,
  dailyEntryFromRemote,
  goalFromRemote,
  goalGroupFromRemote,
  goalStepFromRemote,
  type RemoteCategoryTag,
  type RemoteChecklistItem,
  type RemoteDailyEntry,
  type RemoteGoal,
  type RemoteGoalGroup,
  type RemoteGoalStep,
} from './entity-mappers';

export async function refreshAccountCache(scope: AppScope): Promise<void> {
  if (scope.kind !== 'user') {
    return;
  }

  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for account persistence.');
  }

  const [
    categoryTagsResponse,
    dailyEntriesResponse,
    checklistItemsResponse,
    goalGroupsResponse,
    goalsResponse,
    goalStepsResponse,
  ] = await Promise.all([
    client.from('category_tags').select('*'),
    client.from('daily_entries').select('*'),
    client.from('checklist_items').select('*'),
    client.from('goal_groups').select('*'),
    client.from('goals').select('*'),
    client.from('goal_steps').select('*'),
  ]);

  const firstError =
    categoryTagsResponse.error ??
    dailyEntriesResponse.error ??
    checklistItemsResponse.error ??
    goalGroupsResponse.error ??
    goalsResponse.error ??
    goalStepsResponse.error;

  if (firstError) {
    throw firstError;
  }

  await db.transaction(
    'rw',
    [
      db.categoryTags,
      db.dailyEntries,
      db.checklistItems,
      db.goalGroups,
      db.goals,
      db.goalSteps,
    ],
    async () => {
      await Promise.all([
        db.categoryTags.where('scopeId').equals(scope.id).delete(),
        db.dailyEntries.where('scopeId').equals(scope.id).delete(),
        db.checklistItems.where('scopeId').equals(scope.id).delete(),
        db.goalGroups.where('scopeId').equals(scope.id).delete(),
        db.goals.where('scopeId').equals(scope.id).delete(),
        db.goalSteps.where('scopeId').equals(scope.id).delete(),
      ]);
      await db.categoryTags.bulkPut(
        ((categoryTagsResponse.data ?? []) as RemoteCategoryTag[]).map((row) =>
          categoryTagFromRemote(scope, row),
        ),
      );
      await db.dailyEntries.bulkPut(
        ((dailyEntriesResponse.data ?? []) as RemoteDailyEntry[]).map((row) =>
          dailyEntryFromRemote(scope, row),
        ),
      );
      await db.checklistItems.bulkPut(
        ((checklistItemsResponse.data ?? []) as RemoteChecklistItem[]).map(
          (row) => checklistItemFromRemote(scope, row),
        ),
      );
      await db.goalGroups.bulkPut(
        ((goalGroupsResponse.data ?? []) as RemoteGoalGroup[]).map((row) =>
          goalGroupFromRemote(scope, row),
        ),
      );
      await db.goals.bulkPut(
        ((goalsResponse.data ?? []) as RemoteGoal[]).map((row) =>
          goalFromRemote(scope, row),
        ),
      );
      await db.goalSteps.bulkPut(
        ((goalStepsResponse.data ?? []) as RemoteGoalStep[]).map((row) =>
          goalStepFromRemote(scope, row),
        ),
      );
    },
  );
}
