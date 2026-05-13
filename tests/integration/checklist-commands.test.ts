import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  createChecklistChild,
  createChecklistItem,
  createColorTag,
  assignChecklistItemColor,
  db,
  indentChecklistItem,
  openOrCreateDailyEntry,
  outdentChecklistItem,
  reorderColorTag,
  softDeleteChecklistItem,
  softDeleteColorTag,
  toggleChecklistItemChecked,
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

  it('assigns color tags and clears references when a tag is deleted', async () => {
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
    const colorTag = await createColorTag({
      scope,
      name: 'Deep work',
      hex: '#2563eb',
    });

    await assignChecklistItemColor({
      scope,
      itemId: firstItem.id,
      colorTagId: colorTag.id,
    });
    await assignChecklistItemColor({
      scope,
      itemId: secondItem.id,
      colorTagId: colorTag.id,
    });
    await toggleChecklistItemChecked({ scope, itemId: firstItem.id });

    const coloredFirstItem = await db.checklistItems.get(firstItem.id);
    const partiallyCompletedEntry = await db.dailyEntries.get(entry.id);
    expect(coloredFirstItem?.colorTagId).toBe(colorTag.id);
    expect(partiallyCompletedEntry?.colorTagIds).toEqual([colorTag.id]);
    expect(partiallyCompletedEntry?.colorSummaries).toEqual([
      {
        colorTagId: colorTag.id,
        itemCount: 2,
        completedCount: 1,
      },
    ]);

    await toggleChecklistItemChecked({ scope, itemId: secondItem.id });

    const completedColorEntry = await db.dailyEntries.get(entry.id);
    expect(completedColorEntry?.colorSummaries).toEqual([
      {
        colorTagId: colorTag.id,
        itemCount: 2,
        completedCount: 2,
      },
    ]);

    await softDeleteColorTag({ scope, colorTagId: colorTag.id });

    const clearedItem = await db.checklistItems.get(firstItem.id);
    const clearedEntry = await db.dailyEntries.get(entry.id);
    expect(clearedItem?.colorTagId).toBeNull();
    expect(clearedEntry?.colorTagIds).toEqual([]);
    expect(clearedEntry?.colorSummaries).toEqual([]);
  });

  it('reorders color tags by position', async () => {
    const scope = createGuestScope('local-test');
    const firstTag = await createColorTag({
      scope,
      name: 'First',
      hex: '#2563eb',
    });
    const secondTag = await createColorTag({
      scope,
      name: 'Second',
      hex: '#16a34a',
    });
    const thirdTag = await createColorTag({
      scope,
      name: 'Third',
      hex: '#d97706',
    });

    await reorderColorTag({
      scope,
      colorTagId: thirdTag.id,
      direction: 'up',
    });

    const reorderedTags = await db.colorTags
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
});
