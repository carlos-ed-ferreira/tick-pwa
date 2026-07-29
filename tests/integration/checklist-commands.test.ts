import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareSortRanks, createGuestScope } from '@/lib/domain';
import {
  applyChecklistTemplateToDateRange,
  assignChecklistItemCategory,
  clearChecklistItemsFromDateRange,
  createChecklistChild,
  createChecklistItem,
  createCategoryTag,
  db,
  duplicateChecklistItemToDate,
  duplicateChecklistItemsToDate,
  indentChecklistItem,
  openOrCreateDailyEntry,
  moveChecklistItemToDate,
  moveChecklistItemsToDate,
  moveChecklistItemToParent,
  outdentChecklistItem,
  reorderChecklistItem,
  reorderChecklistItemsByScheduledTime,
  reorderCategoryTag,
  softDeleteChecklistItem,
  softDeleteCategoryTag,
  toggleChecklistItemChecked,
  toggleChecklistItemBold,
  toggleChecklistItemPriority,
  setChecklistItemsChecked,
  updateCategoryTag,
  updateChecklistItemText,
  updateChecklistItemScheduledTime,
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

    expect(updatedEntry).toMatchObject({
      previewText: 'Plan tomorrow',
      itemCount: 1,
      completedCount: 1,
    });
  });

  it('cycles checklist tasks through completed, ignored, and unchecked without counting ignored tasks', async () => {
    const scope = createGuestScope('checklist-ignore-cycle');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-14',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Optional task',
    });

    await toggleChecklistItemChecked({ scope, itemId: item.id });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      checked: true,
      ignored: false,
    });

    await toggleChecklistItemChecked({ scope, itemId: item.id });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      checked: false,
      ignored: true,
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      itemCount: 0,
      completedCount: 0,
    });

    await toggleChecklistItemChecked({ scope, itemId: item.id });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      checked: false,
      ignored: false,
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      itemCount: 1,
      completedCount: 0,
    });
  });

  it('toggles bold formatting for a checklist task', async () => {
    const scope = createGuestScope('checklist-bold');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-15',
      timezone: 'America/Sao_Paulo',
    });
    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Important task',
    });

    await toggleChecklistItemBold({ scope, itemId: item.id });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      bold: true,
    });

    await toggleChecklistItemBold({ scope, itemId: item.id });
    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      bold: false,
    });
  });

  it('does not persist empty checklist items or empty text updates', async () => {
    const scope = createGuestScope('checklist-empty-guard');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });

    await expect(
      createChecklistItem({
        scope,
        dailyEntryId: entry.id,
        text: '   ',
      }),
    ).rejects.toThrow(/require text/i);

    const item = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Keep me',
    });
    await updateChecklistItemText({
      scope,
      itemId: item.id,
      text: '   ',
    });

    await expect(db.checklistItems.get(item.id)).resolves.toMatchObject({
      text: 'Keep me',
    });
  });

  it('bulk toggles selected checklist items within the same scope', async () => {
    const scope = createGuestScope('checklist-bulk-toggle');
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
      text: 'Second',
    });

    await setChecklistItemsChecked({
      scope,
      itemIds: [first.id, second.id],
      checked: true,
    });

    await expect(db.checklistItems.get(first.id)).resolves.toMatchObject({
      checked: true,
    });
    await expect(db.checklistItems.get(second.id)).resolves.toMatchObject({
      checked: true,
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      completedCount: 2,
    });

    await setChecklistItemsChecked({
      scope,
      itemIds: [first.id, second.id],
      checked: false,
      ignored: true,
    });

    await expect(db.checklistItems.get(first.id)).resolves.toMatchObject({
      checked: false,
      ignored: true,
    });
    await expect(db.checklistItems.get(second.id)).resolves.toMatchObject({
      checked: false,
      ignored: true,
    });
    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      completedCount: 0,
    });
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

    await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
      text: 'Child',
    });
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

  it('moves an item under another item without creating a cycle', async () => {
    const scope = createGuestScope('checklist-reparent');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const parent = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Parent',
    });
    const child = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: parent.id,
      text: 'Child',
    });

    await moveChecklistItemToParent({
      scope,
      itemId: child.id,
      parentItemId: parent.id,
    });
    await moveChecklistItemToParent({
      scope,
      itemId: parent.id,
      parentItemId: child.id,
    });

    await expect(db.checklistItems.get(child.id)).resolves.toMatchObject({
      parentId: parent.id,
    });
    await expect(db.checklistItems.get(parent.id)).resolves.toMatchObject({
      parentId: null,
    });
  });

  it('moves a checklist tree to another day and updates both summaries', async () => {
    const scope = createGuestScope('move-tree-test');
    const sourceEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const targetEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });
    const sourceRoot = await createChecklistItem({
      scope,
      dailyEntryId: sourceEntry.id,
      text: 'Source root',
    });
    const sourceChild = await createChecklistChild({
      scope,
      dailyEntryId: sourceEntry.id,
      parentItemId: sourceRoot.id,
      text: 'Source child',
    });
    await createChecklistItem({
      scope,
      dailyEntryId: targetEntry.id,
      text: 'Target root',
    });

    await moveChecklistItemToDate({
      scope,
      itemId: sourceRoot.id,
      targetDate: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });

    const movedSourceRoot = await db.checklistItems.get(sourceRoot.id);
    const movedSourceChild = await db.checklistItems.get(sourceChild.id);
    const updatedSourceEntry = await db.dailyEntries.get(sourceEntry.id);
    const updatedTargetEntry = await db.dailyEntries.get(targetEntry.id);
    const targetItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, targetEntry.id])
      .filter((item) => item.deletedAt === null)
      .sortBy('sortRank');

    expect(movedSourceRoot).toMatchObject({
      dailyEntryId: targetEntry.id,
    });
    expect(movedSourceChild).toMatchObject({
      dailyEntryId: targetEntry.id,
    });
    expect(
      targetItems
        .filter((item) => item.parentId === null)
        .map((item) => item.text),
    ).toEqual(['Target root', 'Source root']);
    expect(
      targetItems
        .filter((item) => item.parentId === sourceRoot.id)
        .map((item) => item.text),
    ).toEqual(['Source child']);
    expect(updatedSourceEntry).toMatchObject({
      previewText: '',
      itemCount: 0,
      completedCount: 0,
      categoryTagIds: [],
    });
    expect(updatedTargetEntry).toMatchObject({
      previewText: 'Target root',
      itemCount: 3,
      completedCount: 0,
    });
  });

  it('duplicates a checklist tree into another day without changing the source', async () => {
    const scope = createGuestScope('duplicate-tree-test');
    const sourceEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const targetEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });
    const sourceRoot = await createChecklistItem({
      scope,
      dailyEntryId: sourceEntry.id,
      text: 'Source root',
    });
    const sourceChild = await createChecklistChild({
      scope,
      dailyEntryId: sourceEntry.id,
      parentItemId: sourceRoot.id,
      text: 'Source child',
    });

    await duplicateChecklistItemToDate({
      scope,
      itemId: sourceRoot.id,
      targetDate: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });

    const sourceItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, sourceEntry.id])
      .filter((item) => item.deletedAt === null)
      .sortBy('sortRank');
    const targetItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, targetEntry.id])
      .filter((item) => item.deletedAt === null)
      .sortBy('sortRank');
    const duplicatedRoot = targetItems.find((item) => item.parentId === null);
    const duplicatedChild = targetItems.find(
      (item) => item.parentId === duplicatedRoot?.id,
    );
    const updatedTargetEntry = await db.dailyEntries.get(targetEntry.id);

    expect(
      sourceItems
        .filter((item) => item.parentId === null)
        .map((item) => item.text),
    ).toEqual(['Source root']);
    expect(
      sourceItems
        .filter((item) => item.parentId === sourceRoot.id)
        .map((item) => item.text),
    ).toEqual(['Source child']);
    expect(
      targetItems
        .filter((item) => item.parentId === null)
        .map((item) => item.text),
    ).toEqual(['Source root']);
    expect(
      targetItems
        .filter((item) => item.parentId === duplicatedRoot?.id)
        .map((item) => item.text),
    ).toEqual(['Source child']);
    expect(duplicatedRoot?.id).not.toBe(sourceRoot.id);
    expect(duplicatedChild?.id).not.toBe(sourceChild.id);
    expect(duplicatedChild?.parentId).toBe(duplicatedRoot?.id ?? null);
    expect(updatedTargetEntry).toMatchObject({
      previewText: 'Source root',
      itemCount: 2,
      completedCount: 0,
    });
  });

  it('moves all checklist items from one day to another day', async () => {
    const scope = createGuestScope('move-day-test');
    const sourceEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const targetEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });
    const sourceRoot = await createChecklistItem({
      scope,
      dailyEntryId: sourceEntry.id,
      text: 'Source root',
    });
    await createChecklistChild({
      scope,
      dailyEntryId: sourceEntry.id,
      parentItemId: sourceRoot.id,
      text: 'Source child',
    });
    await createChecklistItem({
      scope,
      dailyEntryId: targetEntry.id,
      text: 'Target root',
    });

    await moveChecklistItemsToDate({
      scope,
      sourceDailyEntryId: sourceEntry.id,
      targetDate: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });

    const movedSourceItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, sourceEntry.id])
      .filter((item) => item.deletedAt === null)
      .sortBy('sortRank');
    const targetItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, targetEntry.id])
      .filter((item) => item.deletedAt === null)
      .sortBy('sortRank');
    const updatedSourceEntry = await db.dailyEntries.get(sourceEntry.id);
    const updatedTargetEntry = await db.dailyEntries.get(targetEntry.id);

    expect(movedSourceItems).toHaveLength(0);
    expect(
      targetItems
        .filter((item) => item.parentId === null)
        .sort((firstItem, secondItem) =>
          compareSortRanks(firstItem.sortRank, secondItem.sortRank),
        )
        .map((item) => item.text),
    ).toEqual(['Target root', 'Source root']);
    expect(
      targetItems
        .filter((item) => item.parentId === sourceRoot.id)
        .map((item) => item.text),
    ).toEqual(['Source child']);
    expect(updatedSourceEntry).toMatchObject({
      previewText: '',
      itemCount: 0,
      completedCount: 0,
      categoryTagIds: [],
    });
    expect(updatedTargetEntry).toMatchObject({
      previewText: 'Target root',
      itemCount: 3,
      completedCount: 0,
    });
  });

  it('duplicates all checklist items from one day into another day', async () => {
    const scope = createGuestScope('duplicate-day-test');
    const sourceEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-21',
      timezone: 'America/Sao_Paulo',
    });
    const targetEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });
    const sourceRoot = await createChecklistItem({
      scope,
      dailyEntryId: sourceEntry.id,
      text: 'Source root',
    });
    const sourceChild = await createChecklistChild({
      scope,
      dailyEntryId: sourceEntry.id,
      parentItemId: sourceRoot.id,
      text: 'Source child',
    });

    await duplicateChecklistItemsToDate({
      scope,
      sourceDailyEntryId: sourceEntry.id,
      targetDate: '2026-05-22',
      timezone: 'America/Sao_Paulo',
    });

    const sourceItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, sourceEntry.id])
      .filter((item) => item.deletedAt === null)
      .toArray();
    const targetItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, targetEntry.id])
      .filter((item) => item.deletedAt === null)
      .toArray();
    const duplicatedRoot = targetItems.find((item) => item.parentId === null);
    const duplicatedChild = targetItems.find(
      (item) => item.parentId === duplicatedRoot?.id,
    );
    const updatedTargetEntry = await db.dailyEntries.get(targetEntry.id);

    expect(
      sourceItems
        .filter((item) => item.parentId === null)
        .map((item) => item.text),
    ).toEqual(['Source root']);
    expect(
      sourceItems
        .filter((item) => item.parentId === sourceRoot.id)
        .map((item) => item.text),
    ).toEqual(['Source child']);
    expect(
      targetItems
        .filter((item) => item.parentId === null)
        .map((item) => item.text),
    ).toEqual(['Source root']);
    expect(
      targetItems
        .filter((item) => item.parentId === duplicatedRoot?.id)
        .map((item) => item.text),
    ).toEqual(['Source child']);
    expect(duplicatedRoot?.id).not.toBe(sourceRoot.id);
    expect(duplicatedChild?.id).not.toBe(sourceChild.id);
    expect(duplicatedChild?.parentId).toBe(duplicatedRoot?.id ?? null);
    expect(updatedTargetEntry).toMatchObject({
      previewText: 'Source root',
      itemCount: 2,
      completedCount: 0,
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
      surface: 'calendar',
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
      surface: 'calendar',
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
      surface: 'calendar',
      name: 'First',
      colorHex: '#2563eb',
    });
    const secondTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Second',
      colorHex: '#16a34a',
    });
    const thirdTag = await createCategoryTag({
      scope,
      surface: 'calendar',
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

    await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
      text: 'Nested second',
    });
    const nestedThird = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
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

  it('sorts timed roots on demand while preserving nesting and untimed order', async () => {
    const scope = createGuestScope('checklist-time-sort-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const first = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'No time first',
    });
    const second = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: first.id,
      text: 'Late',
    });
    const third = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: second.id,
      text: 'Early',
    });
    const fourth = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: third.id,
      text: 'No time second',
    });
    const nestedFirst = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: second.id,
      text: 'Nested first',
    });
    const nestedSecond = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: second.id,
      text: 'Nested second',
    });

    await updateChecklistItemScheduledTime({
      scope,
      itemId: second.id,
      scheduledTime: '18:30',
    });
    await updateChecklistItemScheduledTime({
      scope,
      itemId: third.id,
      scheduledTime: '08:15',
    });
    await reorderChecklistItemsByScheduledTime({
      scope,
      dailyEntryId: entry.id,
    });

    async function getRootTexts() {
      const rootItems = await db.checklistItems
        .where('[scopeId+dailyEntryId]')
        .equals([scope.id, entry.id])
        .filter((item) => item.deletedAt === null && item.parentId === null)
        .toArray();
      rootItems.sort((firstItem, secondItem) =>
        compareSortRanks(firstItem.sortRank, secondItem.sortRank),
      );

      return rootItems.map((item) => ({
        scheduledTime: item.scheduledTime,
        text: item.text,
      }));
    }

    const expectedRootOrder = [
      { scheduledTime: '08:15', text: 'Early' },
      { scheduledTime: '18:30', text: 'Late' },
      { scheduledTime: null, text: 'No time first' },
      { scheduledTime: null, text: 'No time second' },
    ];

    await expect(getRootTexts()).resolves.toEqual(expectedRootOrder);

    const nestedItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .filter((item) => item.deletedAt === null && item.parentId === second.id)
      .toArray();
    nestedItems.sort((firstItem, secondItem) =>
      compareSortRanks(firstItem.sortRank, secondItem.sortRank),
    );

    expect(nestedItems.map((item) => item.text)).toEqual([
      'Nested first',
      'Nested second',
    ]);
    expect(nestedItems.map((item) => item.id)).toEqual([
      nestedFirst.id,
      nestedSecond.id,
    ]);

    await reorderChecklistItemsByScheduledTime({
      scope,
      dailyEntryId: entry.id,
    });

    await expect(getRootTexts()).resolves.toEqual(expectedRootOrder);

    await updateChecklistItemScheduledTime({
      scope,
      itemId: second.id,
      scheduledTime: '',
    });

    await expect(db.checklistItems.get(second.id)).resolves.toMatchObject({
      scheduledTime: null,
    });

    await expect(db.dailyEntries.get(entry.id)).resolves.toMatchObject({
      previewText: 'Early',
    });

    expect(fourth.id).toBeTruthy();
  });

  it('keeps tied scheduled times in their current relative order', async () => {
    const scope = createGuestScope('checklist-time-tie-test');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-05-13',
      timezone: 'America/Sao_Paulo',
    });
    const first = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Tie first',
    });
    const second = await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      afterItemId: first.id,
      text: 'Tie second',
    });

    await updateChecklistItemScheduledTime({
      scope,
      itemId: first.id,
      scheduledTime: '09:00',
    });
    await updateChecklistItemScheduledTime({
      scope,
      itemId: second.id,
      scheduledTime: '09:00',
    });
    await reorderChecklistItemsByScheduledTime({
      scope,
      dailyEntryId: entry.id,
    });

    const rootItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .filter((item) => item.deletedAt === null && item.parentId === null)
      .toArray();
    rootItems.sort((firstItem, secondItem) =>
      compareSortRanks(firstItem.sortRank, secondItem.sortRank),
    );

    expect(rootItems.map((item) => item.text)).toEqual([
      'Tie first',
      'Tie second',
    ]);
  });

  it('does not reorder items when only a scheduled time is updated', async () => {
    const scope = createGuestScope('checklist-time-no-auto-sort');
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
    const nested = await createChecklistChild({
      scope,
      dailyEntryId: entry.id,
      parentItemId: first.id,
      text: 'Nested',
    });

    const itemsBefore = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .toArray();
    const ranksBefore = new Map(
      itemsBefore.map((item) => [
        item.id,
        { parentId: item.parentId, sortRank: item.sortRank },
      ]),
    );

    await updateChecklistItemScheduledTime({
      scope,
      itemId: second.id,
      scheduledTime: '07:45',
    });

    const itemsAfter = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, entry.id])
      .toArray();

    for (const item of itemsAfter) {
      expect({ parentId: item.parentId, sortRank: item.sortRank }).toEqual(
        ranksBefore.get(item.id),
      );
    }

    expect(nested.id).toBeTruthy();
  });

  it('applies a checklist template across a weekday-filtered range', async () => {
    const scope = createGuestScope('bulk-range-test');
    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
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
          ignored: false,
          bold: false,
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
          ignored: false,
          bold: true,
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
          ignored: false,
          bold: false,
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
        bold: true,
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

  it('clears checklist items across a weekday-filtered range', async () => {
    const scope = createGuestScope('bulk-clear-test');
    const categoryTag = await createCategoryTag({
      scope,
      surface: 'calendar',
      name: 'Focus',
      colorHex: '#345d7e',
    });
    const fridayEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-01-02',
      timezone: 'America/Sao_Paulo',
    });
    const mondayEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-01-05',
      timezone: 'America/Sao_Paulo',
    });
    const tuesdayEntry = await openOrCreateDailyEntry({
      scope,
      date: '2026-01-06',
      timezone: 'America/Sao_Paulo',
    });
    const fridayRoot = await createChecklistItem({
      scope,
      dailyEntryId: fridayEntry.id,
      text: 'Friday root',
    });

    await assignChecklistItemCategory({
      scope,
      itemId: fridayRoot.id,
      categoryTagId: categoryTag.id,
    });
    await toggleChecklistItemChecked({ scope, itemId: fridayRoot.id });
    await createChecklistItem({
      scope,
      dailyEntryId: fridayEntry.id,
      parentId: fridayRoot.id,
      text: 'Friday child',
    });
    await createChecklistItem({
      scope,
      dailyEntryId: mondayEntry.id,
      text: 'Monday root',
    });
    await createChecklistItem({
      scope,
      dailyEntryId: tuesdayEntry.id,
      text: 'Tuesday root',
    });

    const affectedDates = await clearChecklistItemsFromDateRange({
      scope,
      startDate: '2026-01-01',
      endDate: '2026-01-06',
      selectedWeekdays: [1, 5],
    });

    expect(affectedDates).toEqual(['2026-01-02', '2026-01-05']);

    const fridayItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, fridayEntry.id])
      .filter((item) => item.deletedAt === null)
      .toArray();
    const mondayItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, mondayEntry.id])
      .filter((item) => item.deletedAt === null)
      .toArray();
    const tuesdayItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, tuesdayEntry.id])
      .filter((item) => item.deletedAt === null)
      .toArray();
    const deletedFridayItems = await db.checklistItems
      .where('[scopeId+dailyEntryId]')
      .equals([scope.id, fridayEntry.id])
      .filter((item) => item.deletedAt !== null)
      .toArray();
    const updatedFridayEntry = await db.dailyEntries.get(fridayEntry.id);
    const updatedMondayEntry = await db.dailyEntries.get(mondayEntry.id);
    const updatedTuesdayEntry = await db.dailyEntries.get(tuesdayEntry.id);

    expect(fridayItems).toHaveLength(0);
    expect(mondayItems).toHaveLength(0);
    expect(tuesdayItems.map((item) => item.text)).toEqual(['Tuesday root']);
    expect(deletedFridayItems).toHaveLength(2);
    expect(updatedFridayEntry).toMatchObject({
      previewText: '',
      itemCount: 0,
      completedCount: 0,
      categoryTagIds: [],
    });
    expect(updatedMondayEntry).toMatchObject({
      previewText: '',
      itemCount: 0,
      completedCount: 0,
      categoryTagIds: [],
    });
    expect(updatedTuesdayEntry).toMatchObject({
      previewText: 'Tuesday root',
      itemCount: 1,
    });
  });
});
