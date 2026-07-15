import type {
  AppScope,
  CategoryTag,
  CategoryTagSurface,
  Goal,
  GoalGroup,
  GoalStep,
} from '@/lib/domain';
import {
  compareSortRanks,
  createId,
  createSortRankBetween,
} from '@/lib/domain';
import { db } from './database';
import { recalculateDailyEntrySummary } from './daily-entry-commands';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';
import { clearGuestDefaultCategoryTagTracking } from './seed';
import { persistAccountEntityChange } from './account-persistence';

function normalizeColorHex(colorHex: string): string {
  const normalizedHex = colorHex.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return normalizedHex.toLowerCase();
  }

  return '#71717a';
}

function normalizeCategoryTagName(name: string): string {
  return name.normalize('NFC').trim().toLocaleUpperCase();
}

async function getActiveCategoryTags(
  scope: AppScope,
  surface: CategoryTagSurface,
): Promise<CategoryTag[]> {
  const categoryTags = await db.categoryTags
    .where('[scopeId+surface]')
    .equals([scope.id, surface])
    .filter((tag) => tag.deletedAt === null)
    .toArray();

  return categoryTags.sort((firstTag, secondTag) =>
    compareSortRanks(firstTag.position, secondTag.position),
  );
}

async function persistCategoryTagUpdate(
  scope: AppScope,
  categoryTag: CategoryTag,
  changedFields: string[],
): Promise<void> {
  await db.categoryTags.put(categoryTag);
  await persistAccountEntityChange({
    scope,
    entityType: 'categoryTag',
    entityId: categoryTag.id,
    operation: categoryTag.deletedAt ? 'delete' : 'upsert',
    payload: categoryTag as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: categoryTag.remoteRevision,
  });
}

function touchCategoryTag(
  scope: AppScope,
  categoryTag: CategoryTag,
): CategoryTag {
  const now = createTimestamp();

  return {
    ...categoryTag,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

export async function createCategoryTag({
  scope,
  surface,
  name,
  colorHex,
  useOwnName = false,
}: {
  scope: AppScope;
  surface: CategoryTagSurface;
  name: string;
  colorHex: string;
  useOwnName?: boolean;
}): Promise<CategoryTag> {
  return db.transaction('rw', db.categoryTags, async () => {
    const categoryTags = await getActiveCategoryTags(scope, surface);
    const now = createTimestamp();
    const categoryTag: CategoryTag = {
      id: createId(),
      scopeId: scope.id,
      surface,
      name: useOwnName ? '' : normalizeCategoryTagName(name) || 'CATEGORY',
      colorHex: normalizeColorHex(colorHex),
      position: createSortRankBetween(
        categoryTags.at(-1)?.position ?? null,
        null,
      ),
      useOwnName,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...createSyncMetadata(scope, now),
    };

    await db.categoryTags.add(categoryTag);
    await persistAccountEntityChange({
      scope,
      entityType: 'categoryTag',
      entityId: categoryTag.id,
      operation: 'upsert',
      payload: categoryTag as unknown as Record<string, unknown>,
      changedFields: ['created'],
      baseRevision: null,
    });

    return categoryTag;
  });
}

export async function updateCategoryTag({
  scope,
  categoryTagId,
  name,
  colorHex,
  useOwnName,
}: {
  scope: AppScope;
  categoryTagId: string;
  name?: string;
  colorHex?: string;
  useOwnName?: boolean;
}): Promise<void> {
  await db.transaction('rw', db.categoryTags, db.localPreferences, async () => {
    const categoryTag = await db.categoryTags.get(categoryTagId);

    if (
      !categoryTag ||
      categoryTag.scopeId !== scope.id ||
      categoryTag.deletedAt
    ) {
      return;
    }

    const nextUseOwnName = useOwnName ?? categoryTag.useOwnName;
    const nextName = nextUseOwnName
      ? ''
      : name === undefined
        ? categoryTag.name
        : normalizeCategoryTagName(name) || categoryTag.name;
    const nextColorHex =
      colorHex === undefined
        ? categoryTag.colorHex
        : normalizeColorHex(colorHex);

    if (
      nextName === categoryTag.name &&
      nextColorHex === categoryTag.colorHex &&
      nextUseOwnName === categoryTag.useOwnName
    ) {
      return;
    }

    const updatedCategoryTag = touchCategoryTag(scope, {
      ...categoryTag,
      name: nextName,
      colorHex: nextColorHex,
      useOwnName: nextUseOwnName,
    });
    const changedFields = [
      ...(nextName === categoryTag.name ? [] : ['name']),
      ...(colorHex === undefined ? [] : ['colorHex']),
      ...(useOwnName === undefined ? [] : ['useOwnName']),
    ];

    if (changedFields.length === 0) {
      return;
    }

    await persistCategoryTagUpdate(scope, updatedCategoryTag, changedFields);

    if (
      scope.kind === 'guest' &&
      name !== undefined &&
      nextName !== categoryTag.name
    ) {
      await clearGuestDefaultCategoryTagTracking(
        scope,
        categoryTag.id,
        categoryTag.surface,
      );
    }
  });
}

export async function reorderCategoryTag({
  scope,
  categoryTagId,
  direction,
}: {
  scope: AppScope;
  categoryTagId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  await db.transaction('rw', db.categoryTags, async () => {
    const targetCategoryTag = await db.categoryTags.get(categoryTagId);

    if (
      !targetCategoryTag ||
      targetCategoryTag.scopeId !== scope.id ||
      targetCategoryTag.deletedAt
    ) {
      return;
    }

    const categoryTags = await getActiveCategoryTags(
      scope,
      targetCategoryTag.surface,
    );
    const currentIndex = categoryTags.findIndex(
      (tag) => tag.id === categoryTagId,
    );

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= categoryTags.length) {
      return;
    }

    const currentCategoryTag = categoryTags[currentIndex];
    const reorderedTags = categoryTags.filter(
      (tag) => tag.id !== categoryTagId,
    );
    reorderedTags.splice(nextIndex, 0, currentCategoryTag);

    const previousTag = reorderedTags[nextIndex - 1] ?? null;
    const followingTag = reorderedTags[nextIndex + 1] ?? null;
    const updatedCategoryTag = touchCategoryTag(scope, {
      ...currentCategoryTag,
      position: createSortRankBetween(
        previousTag?.position ?? null,
        followingTag?.position ?? null,
      ),
    });

    await persistCategoryTagUpdate(scope, updatedCategoryTag, ['position']);
  });
}

export async function softDeleteCategoryTag({
  scope,
  categoryTagId,
}: {
  scope: AppScope;
  categoryTagId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.dailyEntries,
      db.checklistItems,
      db.categoryTags,
      db.goalGroups,
      db.goals,
      db.goalSteps,
      db.localPreferences,
    ],
    async () => {
      const categoryTag = await db.categoryTags.get(categoryTagId);

      if (
        !categoryTag ||
        categoryTag.scopeId !== scope.id ||
        categoryTag.deletedAt
      ) {
        return;
      }

      const now = createTimestamp();
      const deletedCategoryTag = touchCategoryTag(scope, {
        ...categoryTag,
        deletedAt: now,
      });
      await persistCategoryTagUpdate(scope, deletedCategoryTag, ['deletedAt']);

      if (scope.kind === 'guest') {
        await clearGuestDefaultCategoryTagTracking(
          scope,
          categoryTag.id,
          categoryTag.surface,
        );
      }

      const affectedItems = await db.checklistItems
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (item) =>
            item.deletedAt === null && item.categoryTagId === categoryTag.id,
        )
        .toArray();
      const affectedDailyEntryIds = new Set<string>();

      for (const item of affectedItems) {
        affectedDailyEntryIds.add(item.dailyEntryId);
        const updatedItem = {
          ...item,
          categoryTagId: null,
          updatedAt: now,
          syncStatus: getEntitySyncStatus(scope),
          clientUpdatedAt: now,
        };

        await db.checklistItems.put(updatedItem);
        await persistAccountEntityChange({
          scope,
          entityType: 'checklistItem',
          entityId: updatedItem.id,
          operation: 'upsert',
          payload: updatedItem as unknown as Record<string, unknown>,
          changedFields: ['categoryTagId'],
          baseRevision: updatedItem.remoteRevision,
        });
      }

      for (const dailyEntryId of affectedDailyEntryIds) {
        await recalculateDailyEntrySummary({ scope, dailyEntryId });
      }

      const affectedGoalGroups = await db.goalGroups
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (group) =>
            group.deletedAt === null && group.categoryTagId === categoryTag.id,
        )
        .toArray();

      for (const group of affectedGoalGroups) {
        const updatedGroup = {
          ...group,
          categoryTagId: null,
          updatedAt: now,
          syncStatus: getEntitySyncStatus(scope),
          clientUpdatedAt: now,
        } as GoalGroup;
        await db.goalGroups.put(updatedGroup);
        await persistAccountEntityChange({
          scope,
          entityType: 'goalGroup',
          entityId: group.id,
          operation: 'upsert',
          payload: updatedGroup as unknown as Record<string, unknown>,
          changedFields: ['categoryTagId'],
          baseRevision: group.remoteRevision,
        });
      }

      const affectedGoals = await db.goals
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (goal) =>
            goal.deletedAt === null && goal.categoryTagId === categoryTag.id,
        )
        .toArray();

      for (const goal of affectedGoals) {
        await db.goals.put({
          ...goal,
          categoryTagId: null,
          updatedAt: now,
          syncStatus: getEntitySyncStatus(scope),
          clientUpdatedAt: now,
        } as Goal);
        await persistAccountEntityChange({
          scope,
          entityType: 'goal',
          entityId: goal.id,
          operation: 'upsert',
          payload: {
            ...goal,
            categoryTagId: null,
            updatedAt: now,
            syncStatus: getEntitySyncStatus(scope),
            clientUpdatedAt: now,
          } as unknown as Record<string, unknown>,
          changedFields: ['categoryTagId'],
          baseRevision: goal.remoteRevision,
        });
      }

      const affectedGoalSteps = await db.goalSteps
        .where('scopeId')
        .equals(scope.id)
        .filter(
          (goalStep) =>
            goalStep.deletedAt === null &&
            goalStep.categoryTagId === categoryTag.id,
        )
        .toArray();

      for (const goalStep of affectedGoalSteps) {
        await db.goalSteps.put({
          ...goalStep,
          categoryTagId: null,
          updatedAt: now,
          syncStatus: getEntitySyncStatus(scope),
          clientUpdatedAt: now,
        } as GoalStep);
        await persistAccountEntityChange({
          scope,
          entityType: 'goalStep',
          entityId: goalStep.id,
          operation: 'upsert',
          payload: {
            ...goalStep,
            categoryTagId: null,
            updatedAt: now,
            syncStatus: getEntitySyncStatus(scope),
            clientUpdatedAt: now,
          } as unknown as Record<string, unknown>,
          changedFields: ['categoryTagId'],
          baseRevision: goalStep.remoteRevision,
        });
      }
    },
  );
}
