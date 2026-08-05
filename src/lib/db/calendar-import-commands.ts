import type { AppScope, LocalDateString } from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';
import type { WeekdayIndex } from '@/lib/time';
import {
  createCategoryTag,
  normalizeCategoryTagName,
} from './category-commands';
import { db } from './database';
import {
  applyChecklistTemplateToDateRange,
  type ChecklistTemplateItem,
} from './checklist-commands';

const importCategorySurface = 'checklist_item';
const everyWeekday: readonly WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];

export interface CalendarImportCategory {
  name: string;
  colorHex: string;
}

export interface CalendarImportItem {
  id: string;
  parentId: string | null;
  text: string;
  scheduledTime: string | null;
  checked: boolean;
  ignored: boolean;
  bold: boolean;
  priority: boolean;
  collapsed: boolean;
  category: CalendarImportCategory | null;
  sortRank: string;
}

export interface CalendarImportDay {
  date: LocalDateString;
  items: CalendarImportItem[];
}

export interface CalendarImportSummary {
  dates: LocalDateString[];
  createdCategoryCount: number;
  itemCount: number;
}

async function resolveCategoryTagIds({
  scope,
  days,
}: {
  scope: AppScope;
  days: CalendarImportDay[];
}): Promise<{ categoryTagIds: Map<string, string>; createdCount: number }> {
  const requestedCategories = new Map<string, CalendarImportCategory>();

  for (const day of days) {
    for (const item of day.items) {
      if (!item.category) {
        continue;
      }

      const normalizedName = normalizeCategoryTagName(item.category.name);

      if (!normalizedName || requestedCategories.has(normalizedName)) {
        continue;
      }

      requestedCategories.set(normalizedName, item.category);
    }
  }

  const categoryTagIds = new Map<string, string>();

  if (requestedCategories.size === 0) {
    return { categoryTagIds, createdCount: 0 };
  }

  const existingTags = await db.categoryTags
    .where('[scopeId+surface]')
    .equals([scope.id, importCategorySurface])
    .filter(
      (tag) => tag.deletedAt === null && !tag.useOwnName && tag.name !== '',
    )
    .toArray();

  for (const tag of existingTags.sort((firstTag, secondTag) =>
    compareSortRanks(firstTag.position, secondTag.position),
  )) {
    if (!categoryTagIds.has(tag.name)) {
      categoryTagIds.set(tag.name, tag.id);
    }
  }

  let createdCount = 0;

  for (const [normalizedName, category] of requestedCategories) {
    if (categoryTagIds.has(normalizedName)) {
      continue;
    }

    const createdTag = await createCategoryTag({
      scope,
      surface: importCategorySurface,
      name: category.name,
      colorHex: category.colorHex,
    });

    categoryTagIds.set(normalizedName, createdTag.id);
    createdCount += 1;
  }

  return { categoryTagIds, createdCount };
}

function toTemplateItems(
  items: CalendarImportItem[],
  categoryTagIds: Map<string, string>,
): ChecklistTemplateItem[] {
  return items.map((item) => ({
    id: item.id,
    parentId: item.parentId,
    text: item.text,
    scheduledTime: item.scheduledTime,
    checked: item.checked,
    ignored: item.ignored,
    bold: item.bold,
    priority: item.priority,
    collapsed: item.collapsed,
    categoryTagId: item.category
      ? (categoryTagIds.get(normalizeCategoryTagName(item.category.name)) ??
        null)
      : null,
    sortRank: item.sortRank,
  }));
}

export async function importCalendarDays({
  scope,
  days,
  timezone,
}: {
  scope: AppScope;
  days: CalendarImportDay[];
  timezone: string;
}): Promise<CalendarImportSummary> {
  const importableDays = days.filter((day) => day.items.length > 0);

  if (importableDays.length === 0) {
    return { dates: [], createdCategoryCount: 0, itemCount: 0 };
  }

  const { categoryTagIds, createdCount } = await resolveCategoryTagIds({
    scope,
    days: importableDays,
  });
  const importedDates = new Set<LocalDateString>();
  let itemCount = 0;

  for (const day of importableDays) {
    await applyChecklistTemplateToDateRange({
      scope,
      startDate: day.date,
      endDate: day.date,
      selectedWeekdays: everyWeekday,
      templateItems: toTemplateItems(day.items, categoryTagIds),
      timezone,
    });

    importedDates.add(day.date);
    itemCount += day.items.length;
  }

  return {
    dates: [...importedDates].sort(),
    createdCategoryCount: createdCount,
    itemCount,
  };
}
