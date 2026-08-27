'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type {
  AppScope,
  ChecklistItem,
  DailyEntry,
  LocalDateString,
} from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';
import { db } from '@/lib/db';

export interface DayItemPreview {
  categoryTagIds: string[];
  ignoredCount: number;
}

export function summarizeDayItems(
  checklistItems: ChecklistItem[],
): Map<string, DayItemPreview> {
  const previews = new Map<string, DayItemPreview>();
  const sortedItems = [...checklistItems].sort((firstItem, secondItem) =>
    compareSortRanks(firstItem.sortRank, secondItem.sortRank),
  );

  for (const item of sortedItems) {
    const preview = previews.get(item.dailyEntryId) ?? {
      categoryTagIds: [],
      ignoredCount: 0,
    };

    previews.set(item.dailyEntryId, preview);

    if (item.ignored) {
      preview.ignoredCount += 1;
    }

    if (
      item.categoryTagId &&
      !preview.categoryTagIds.includes(item.categoryTagId)
    ) {
      preview.categoryTagIds.push(item.categoryTagId);
    }
  }

  return previews;
}

export function useMonthDayPreviews(
  scope: AppScope | null,
  entries: DailyEntry[],
): Map<LocalDateString, DayItemPreview> {
  const entryIds = entries.map((entry) => entry.id);
  const entryIdKey = entryIds.join(',');
  const checklistItems = useLiveQuery(
    async () => {
      if (!scope || entryIds.length === 0) {
        return [];
      }

      return db.checklistItems
        .where('[scopeId+dailyEntryId]')
        .anyOf(entryIds.map((entryId) => [scope.id, entryId]))
        .filter((item) => item.deletedAt === null)
        .toArray();
    },
    [scope?.id, entryIdKey],
    [],
  );

  return useMemo(() => {
    const previewsByEntryId = summarizeDayItems(checklistItems ?? []);
    const previewsByDate = new Map<LocalDateString, DayItemPreview>();

    for (const entry of entries) {
      const preview = previewsByEntryId.get(entry.id);

      if (preview) {
        previewsByDate.set(entry.date, preview);
      }
    }

    return previewsByDate;
  }, [checklistItems, entries]);
}
