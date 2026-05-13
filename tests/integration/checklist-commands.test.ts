import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  createChecklistChild,
  createChecklistItem,
  db,
  indentChecklistItem,
  openOrCreateDailyEntry,
  outdentChecklistItem,
  softDeleteChecklistItem,
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
});
