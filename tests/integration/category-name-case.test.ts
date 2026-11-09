import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import {
  createCategoryTag,
  db,
  importCalendarDays,
  updateCategoryTag,
} from '@/lib/db';

const scope = createGuestScope('category-name-case');

function categoryNames() {
  return db.categoryTags
    .where('[scopeId+surface]')
    .equals([scope.id, 'checklist_item'])
    .filter((tag) => tag.deletedAt === null)
    .toArray()
    .then((tags) => tags.map((tag) => tag.name).sort());
}

describe('category names keep the typed capitalization', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('stores a new name as typed, only trimming it', async () => {
    const tag = await createCategoryTag({
      scope,
      surface: 'checklist_item',
      name: '  Saúde e Bem-estar  ',
      colorHex: '#2563eb',
    });

    expect(tag.name).toBe('Saúde e Bem-estar');
  });

  it('keeps acronyms and mixed case when renaming', async () => {
    const tag = await createCategoryTag({
      scope,
      surface: 'checklist_item',
      name: 'Trabalho',
      colorHex: '#2563eb',
    });

    await updateCategoryTag({
      scope,
      categoryTagId: tag.id,
      name: 'TI e eBooks',
    });

    await expect(db.categoryTags.get(tag.id)).resolves.toMatchObject({
      name: 'TI e eBooks',
    });
  });

  it('matches an imported category regardless of capitalization', async () => {
    await createCategoryTag({
      scope,
      surface: 'checklist_item',
      name: 'Saúde',
      colorHex: '#2563eb',
    });

    await importCalendarDays({
      scope,
      timezone: 'America/Sao_Paulo',
      days: [
        {
          date: '2026-11-09',
          items: [
            {
              id: 'imported-1',
              parentId: null,
              text: 'Run',
              scheduledTime: null,
              checked: false,
              ignored: false,
              markLevel: 0,
              bold: false,
              priority: false,
              collapsed: false,
              sortRank: 'a0',
              category: { name: 'SAÚDE', colorHex: '#16a34a' },
            },
            {
              id: 'imported-2',
              parentId: null,
              text: 'Read',
              scheduledTime: null,
              checked: false,
              ignored: false,
              markLevel: 0,
              bold: false,
              priority: false,
              collapsed: false,
              sortRank: 'a1',
              category: { name: 'Leitura', colorHex: '#16a34a' },
            },
          ],
        },
      ],
    });

    await expect(categoryNames()).resolves.toEqual(['Leitura', 'Saúde']);
  });

  it('links an import to the first of two categories that differ only in case', async () => {
    const first = await createCategoryTag({
      scope,
      surface: 'checklist_item',
      name: 'Saúde',
      colorHex: '#2563eb',
    });
    await createCategoryTag({
      scope,
      surface: 'checklist_item',
      name: 'SAÚDE',
      colorHex: '#16a34a',
    });

    await importCalendarDays({
      scope,
      timezone: 'America/Sao_Paulo',
      days: [
        {
          date: '2026-11-09',
          items: [
            {
              id: 'imported-1',
              parentId: null,
              text: 'Run',
              scheduledTime: null,
              checked: false,
              ignored: false,
              markLevel: 0,
              bold: false,
              priority: false,
              collapsed: false,
              sortRank: 'a0',
              category: { name: 'saúde', colorHex: '#000000' },
            },
          ],
        },
      ],
    });

    const [item] = await db.checklistItems.toArray();

    expect(item.categoryTagId).toBe(first.id);
    await expect(categoryNames()).resolves.toEqual(['SAÚDE', 'Saúde']);
  });
});
