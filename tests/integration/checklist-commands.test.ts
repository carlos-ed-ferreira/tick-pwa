import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  applyChecklistTemplateToDateRange,
  assignChecklistItemCategory,
  createChecklistChild,
  createChecklistItem,
  createCategoryTag,
  db,
  indentChecklistItem,
  openOrCreateDailyEntry,
  outdentChecklistItem,
  reorderChecklistItem,
  reorderCategoryTag,
  softDeleteChecklistItem,
  softDeleteCategoryTag,
  toggleChecklistItemChecked,
  toggleChecklistItemPriority,
  updateCategoryTag,
  updateChecklistItemText,
} from '@/lib/db';

describe('checklist commands', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates items locally and keeps daily summaries updated', async () => {
    const scope = createGuestScope('local-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Plan the day',
    });

    await toggleChecklistItemChecked({ scope, itemId: item.id });
    await updateChecklistItemText({
      scope,
      itemId: item.id,
      text: 'Plan tomorrow',
    });

    const updatedEntry = await db.dailyEntries.get(entry.id);
    const outboxCount = await db.syncOutbox.count();

    expect(updatedEntry).toMatchObject({
      previewText: 'Plan tomorrow',
      itemCount: 1,
      completedCount: 1,
    });
    expect(outboxCount).toBe(0);
  });

  it('supports nesting changes and cascaded soft delete', async () => {
    const scope = createGuestScope('local-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const first = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'First',
    });
    const second = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: first.id,
      text: 'Second',
    });

    await indentChecklistItem({ scope, itemId: second.id });

    const indentedSecond = await db.checklistItems.get(second.id);
    expect(indentedSecond?.parentId).toBe(first.id);

    await outdentChecklistItem({ scope, itemId: second.id });

    const outdentedSecond = await db.checklistItems.get(second.id);
    expect(outdentedSecond?.parentId).toBeNull();

    const child = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
    });
    await updateChecklistItemText({ scope, itemId: child.id, text: 'Child' });
    await softDeleteChecklistItem({ scope, itemId: first.id });

    const remainingItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .filter((item) => item.deletedAt === null)
      .toArray();
    const updatedEntry = await db.dailyEntries.get(entry.id);

    expect(remainingItems.map((item) => item.text)).toEqual(['Second']);
    expect(updatedEntry).toMatchObject({
      previewText: 'Second',
      itemCount: 1,
    });
  });

  it('assigns category tags and clears references when a tag is deleted', async () => {
    const scope = createGuestScope('local-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const firstItem = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Colorful task',
    });
    const secondItem = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Another colorful task',
    });
    const categoryTag = await createCategoryTag({
      scope,
      name: 'Deep work',
      colorHex: '#2563eb',
    });

    await assignChecklistItemCategory({
      scope,
      itemId: firstItem.id,
      categoryTagId: categoryTag.id,
    });
    await assignChecklistItemCategory({
      scope,
      itemId: secondItem.id,
      categoryTagId: categoryTag.id,
    });
    await toggleChecklistItemChecked({ scope, itemId: firstItem.id });

    const coloredFirstItem = await db.checklistItems.get(firstItem.id);
    const partiallyCompletedEntry = await db.dailyEntries.get(entry.id);
    expect(coloredFirstItem?.categoryTagId).toBe(categoryTag.id);
    expect(partiallyCompletedEntry?.categoryTagIds).toEqual([categoryTag.id]);
    expect(partiallyCompletedEntry?.categorySummaries).toEqual([
      {
        categoryTagId: categoryTag.id,
        itemCount: 2,
        completedCount: 1,
      },
    ]);

    await toggleChecklistItemChecked({ scope, itemId: secondItem.id });

    const completedColorEntry = await db.dailyEntries.get(entry.id);
    expect(completedColorEntry?.categorySummaries).toEqual([
      {
        categoryTagId: categoryTag.id,
        itemCount: 2,
        completedCount: 2,
      },
    ]);

    await softDeleteCategoryTag({ scope, categoryTagId: categoryTag.id });

    const clearedItem = await db.checklistItems.get(firstItem.id);
    const clearedEntry = await db.dailyEntries.get(entry.id);
    expect(clearedItem?.categoryTagId).toBeNull();
    expect(clearedEntry?.categoryTagIds).toEqual([]);
    expect(clearedEntry?.categorySummaries).toEqual([]);
  });

  it('normalizes category names to uppercase and ignores empty updates', async () => {
    const scope = createGuestScope('local-test');
    const categoryTag = await createCategoryTag({
      scope,
      name: 'Matemática',
      colorHex: '#2563eb',
    });

    expect((await db.categoryTags.get(categoryTag.id))?.name).toBe(
      'MATEMÁTICA',
    );

    await updateCategoryTag({
      scope,
      categoryTagId: categoryTag.id,
      name: 'saúde',
    });

    expect((await db.categoryTags.get(categoryTag.id))?.name).toBe('SAÚDE');

    await updateCategoryTag({
      scope,
      categoryTagId: categoryTag.id,
      name: '   ',
    });

    expect((await db.categoryTags.get(categoryTag.id))?.name).toBe('SAÚDE');
  });

  it('toggles checklist item priority locally', async () => {
    const scope = createGuestScope('local-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Priority task',
    });

    await toggleChecklistItemPriority({ scope, itemId: item.id });

    expect((await db.checklistItems.get(item.id))?.priority).toBe(true);

    await toggleChecklistItemPriority({ scope, itemId: item.id });

    expect((await db.checklistItems.get(item.id))?.priority).toBe(false);
  });

  it('reorders category tags by position', async () => {
    const scope = createGuestScope('local-test');
    const firstTag = await createCategoryTag({
      scope,
      name: 'First',
      colorHex: '#2563eb',
    });
    const secondTag = await createCategoryTag({
      scope,
      name: 'Second',
      colorHex: '#16a34a',
    });
    const thirdTag = await createCategoryTag({
      scope,
      name: 'Third',
      colorHex: '#d97706',
    });

    await reorderCategoryTag({
      scope,
      categoryTagId: thirdTag.id,
      direction: 'up',
    });

    const reorderedTags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .filter((tag) => tag.deletedAt === null)
      .sortBy('position');

    expect(reorderedTags.map((tag) => tag.name)).toEqual([
      firstTag.name,
      thirdTag.name,
      secondTag.name,
    ]);
  });

  it('reorders checklist siblings at the same level', async () => {
    const scope = createGuestScope('local-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const first = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'First',
    });
    const second = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: first.id,
      text: 'Second',
    });
    await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: second.id,
      text: 'Third',
    });

    await reorderChecklistItem({
      scope,
      itemId: first.id,
      direction: 'down',
    });

    let reorderedItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .filter((item) => item.deletedAt === null && item.parentId === null)
      .sortBy('sortRank');

    expect(reorderedItems.map((item) => item.text)).toEqual([
      'Second',
      'First',
      'Third',
    ]);

    let updatedEntry = await db.dailyEntries.get(entry.id);

    expect(updatedEntry?.previewText).toBe('Second');

    const nestedSecond = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
    });
    await updateChecklistItemText({
      scope,
      itemId: nestedSecond.id,
      text: 'Nested second',
    });
    const nestedThird = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
    });
    await updateChecklistItemText({
      scope,
      itemId: nestedThird.id,
      text: 'Nested third',
    });

    await reorderChecklistItem({
      scope,
      itemId: nestedThird.id,
      direction: 'up',
    });

    reorderedItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .filter((item) => item.deletedAt === null && item.parentId === first.id)
      .sortBy('sortRank');

    expect(reorderedItems.map((item) => item.text)).toEqual([
      'Nested third',
      'Nested second',
    ]);

    updatedEntry = await db.dailyEntries.get(entry.id);

    expect(updatedEntry?.itemCount).toBe(5);
  });

  it('applies a checklist template across a weekday-filtered range', async () => {
    const scope = createGuestScope('bulk-range-test');
    const categoryTag = await createCategoryTag({
      scope,
      name: 'Health',
      colorHex: '#4b6f52',
    });
    const existingEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-01-02',
      timezone: 'America/Sao_Paulo',
    });
    await createChecklistItem({
      scope,
      dailyEntryId: existingEntry.id,
      text: 'Existing',
    });

    const affectedDates = await applyChecklistTemplateToDateRange({
      scope,
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      selectedWeekdays: [1, 5],
      timezone: 'America/Sao_Paulo',
      templateItems: [
        {
          id: 'root-1',
          parentId: null,
          text: 'Root task',
          checked: false,
          priority: false,
          collapsed: false,
          categoryTagId: null,
          sortRank: 'U',
        },
        {
          id: 'child-1',
          parentId: 'root-1',
          text: 'Nested task',
          checked: true,
          priority: true,
          collapsed: false,
          categoryTagId: categoryTag.id,
          sortRank: 'U',
        },
        {
          id: 'root-2',
          parentId: null,
          text: 'Later task',
          checked: false,
          priority: true,
          collapsed: true,
          categoryTagId: categoryTag.id,
          sortRank: 'j',
        },
      ],
    });

    expect(affectedDates).toEqual(['2026-01-02', '2026-01-05']);

    const fridayEntry = await db.dailyEntries
      .where('[scopeId+date]')
      .equals([scope.id, '2026-01-02'])
      .first();
    const mondayEntry = await db.dailyEntries
      .where('[scopeId+date]')
      .equals([scope.id, '2026-01-05'])
      .first();
    const createdThursdayEntry = await db.dailyEntries
      .where('[scopeId+date]')
      .equals([scope.id, '2026-01-01'])
      .first();

    expect(createdThursdayEntry).toBeUndefined();
    expect(fridayEntry).toBeTruthy();
    expect(mondayEntry).toBeTruthy();

    const fridayRootItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, fridayEntry!.id])
      .filter((item) => item.deletedAt === null && item.parentId === null)
      .sortBy('sortRank');
    const fridayNestedItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, fridayEntry!.id])
      .filter(
        (item) =>
          item.deletedAt === null && item.parentId === fridayRootItems[1]?.id,
      )
      .sortBy('sortRank');

    expect(fridayRootItems.map((item) => item.text)).toEqual([
      'Existing',
      'Root task',
      'Later task',
    ]);
    expect(fridayNestedItems).toMatchObject([
      {
        text: 'Nested task',
        checked: true,
        priority: true,
        categoryTagId: categoryTag.id,
      },
    ]);
    expect(fridayRootItems[2]?.collapsed).toBe(true);
    expect(fridayRootItems[2]?.priority).toBe(true);
    expect(fridayEntry).toMatchObject({
      itemCount: 4,
      completedCount: 1,
      categoryTagIds: [categoryTag.id],
    });

    const mondayItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, mondayEntry!.id])
      .filter((item) => item.deletedAt === null)
      .sortBy('sortRank');

    expect(mondayItems).toHaveLength(3);
  });
});
