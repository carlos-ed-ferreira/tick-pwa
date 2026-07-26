import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compareSortRanks,
  createGuestScope,
  createUserScope,
} from '@/lib/domain';
import type { CalendarImportDay } from '@/lib/db';
import {
  createCategoryTag,
  createChecklistItem,
  db,
  importCalendarDays,
  openOrCreateDailyEntry,
} from '@/lib/db';
import { waitForAccountPersistence } from '@/lib/db/account-persistence';
import { parseCalendarImportPayload } from '@/features/calendar/calendar-import-parser';

const timezone = 'America/Sao_Paulo';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: supabaseMocks.getSupabaseBrowserClient,
}));

interface RemoteWrite {
  table: string;
  payload: Record<string, unknown>;
}

function createAccountWriteClient() {
  const writes: RemoteWrite[] = [];
  const from = vi.fn((table: string) => ({
    upsert: vi.fn((payload: Record<string, unknown>) => {
      writes.push({ table, payload });

      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { revision: writes.length },
            error: null,
          }),
        })),
      };
    }),
  }));

  return { client: { from }, writes };
}

function parseDays(payload: unknown): CalendarImportDay[] {
  const result = parseCalendarImportPayload(JSON.stringify(payload));

  if (!result.ok) {
    throw new Error(`Invalid payload: ${JSON.stringify(result.errors)}`);
  }

  return result.days;
}

async function getItemsForDate(scopeId: string, date: string) {
  const entry = await db.dailyEntries
    .where('[scopeId+date]')
    .equals([scopeId, date])
    .first();

  if (!entry) {
    return { entry: null, items: [] };
  }

  const items = await db.checklistItems
    .where('[scopeId+dailyEntryId]')
    .equals([scopeId, entry.id])
    .filter((item) => item.deletedAt === null)
    .toArray();

  return {
    entry,
    items: items.sort((firstItem, secondItem) =>
      compareSortRanks(firstItem.sortRank, secondItem.sortRank),
    ),
  };
}

describe('calendar import commands', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates daily entries and items with time, priority and category', async () => {
    const scope = createGuestScope('import-basic');
    const days = parseDays({
      days: [
        {
          date: '2026-07-26',
          items: [
            { text: 'Revisar PRs' },
            {
              text: 'Academia',
              time: '07:30',
              priority: true,
              category: { name: 'Saúde', color: '#16a34a' },
            },
          ],
        },
      ],
    });

    const summary = await importCalendarDays({ scope, days, timezone });

    expect(summary).toMatchObject({
      dates: ['2026-07-26'],
      createdCategoryCount: 1,
      itemCount: 2,
    });

    const { entry, items } = await getItemsForDate(scope.id, '2026-07-26');
    expect(entry).toMatchObject({ itemCount: 2, completedCount: 0 });
    expect(items.map((item) => item.text)).toEqual(['Revisar PRs', 'Academia']);
    expect(items[0]).toMatchObject({
      scheduledTime: null,
      priority: false,
      checked: false,
      categoryTagId: null,
      parentId: null,
    });
    expect(items[1]).toMatchObject({
      scheduledTime: '07:30',
      priority: true,
      checked: false,
    });

    const categoryTag = await db.categoryTags.get(items[1].categoryTagId ?? '');
    expect(categoryTag).toMatchObject({
      name: 'SAÚDE',
      colorHex: '#16a34a',
      surface: 'checklist_item',
      scopeId: scope.id,
    });
  });

  it('reuses an existing category matched by normalized name', async () => {
    const scope = createGuestScope('import-existing-category');
    const existingTag = await createCategoryTag({
      scope,
      surface: 'checklist_item',
      name: 'Saúde',
      colorHex: '#16a34a',
    });
    const days = parseDays({
      days: [
        {
          date: '2026-07-26',
          items: [
            {
              text: 'Academia',
              category: { name: '  saúde  ', color: '#ff0000' },
            },
          ],
        },
      ],
    });

    const summary = await importCalendarDays({ scope, days, timezone });

    expect(summary.createdCategoryCount).toBe(0);

    const { items } = await getItemsForDate(scope.id, '2026-07-26');
    expect(items[0].categoryTagId).toBe(existingTag.id);

    const unchangedTag = await db.categoryTags.get(existingTag.id);
    expect(unchangedTag?.colorHex).toBe('#16a34a');
    expect(
      await db.categoryTags.where('scopeId').equals(scope.id).count(),
    ).toBe(1);
  });

  it('creates each missing category only once across days', async () => {
    const scope = createGuestScope('import-category-once');
    const days = parseDays({
      days: [
        {
          date: '2026-07-26',
          items: [
            { text: 'Academia', category: { name: 'Saúde', color: '#16a34a' } },
          ],
        },
        {
          date: '2026-07-27',
          items: [
            { text: 'Corrida', category: { name: 'SAÚDE', color: '#16a34a' } },
            { text: 'Foco', category: { name: 'Foco', color: '#2563eb' } },
          ],
        },
      ],
    });

    const summary = await importCalendarDays({ scope, days, timezone });

    expect(summary).toMatchObject({
      dates: ['2026-07-26', '2026-07-27'],
      createdCategoryCount: 2,
      itemCount: 3,
    });

    const tags = await db.categoryTags
      .where('scopeId')
      .equals(scope.id)
      .toArray();
    expect(tags.map((tag) => tag.name).sort()).toEqual(['FOCO', 'SAÚDE']);
  });

  it('appends to the tasks that already exist on the day', async () => {
    const scope = createGuestScope('import-append');
    const entry = await openOrCreateDailyEntry({
      scope,
      date: '2026-07-26',
      timezone,
    });
    await createChecklistItem({
      scope,
      dailyEntryId: entry.id,
      text: 'Tarefa anterior',
    });

    await importCalendarDays({
      scope,
      days: parseDays({
        days: [{ date: '2026-07-26', items: [{ text: 'Tarefa importada' }] }],
      }),
      timezone,
    });

    const { entry: updatedEntry, items } = await getItemsForDate(
      scope.id,
      '2026-07-26',
    );
    expect(items.map((item) => item.text)).toEqual([
      'Tarefa anterior',
      'Tarefa importada',
    ]);
    expect(updatedEntry).toMatchObject({ itemCount: 2 });
  });

  it('preserves nested children', async () => {
    const scope = createGuestScope('import-nested');
    const days = parseDays({
      days: [
        {
          date: '2026-07-26',
          items: [
            {
              text: 'Academia',
              children: [
                { text: 'Levar garrafa', children: [{ text: 'Lavar depois' }] },
              ],
            },
          ],
        },
      ],
    });

    await importCalendarDays({ scope, days, timezone });

    const { items } = await getItemsForDate(scope.id, '2026-07-26');
    const root = items.find((item) => item.text === 'Academia');
    const bottle = items.find((item) => item.text === 'Levar garrafa');
    const wash = items.find((item) => item.text === 'Lavar depois');

    expect(root?.parentId).toBeNull();
    expect(bottle?.parentId).toBe(root?.id);
    expect(wash?.parentId).toBe(bottle?.id);
  });

  it('does nothing when there is no day to import', async () => {
    const scope = createGuestScope('import-empty');

    const summary = await importCalendarDays({ scope, days: [], timezone });

    expect(summary).toEqual({
      dates: [],
      createdCategoryCount: 0,
      itemCount: 0,
    });
    expect(
      await db.dailyEntries.where('scopeId').equals(scope.id).count(),
    ).toBe(0);
  });

  it('keeps a guest import away from Supabase', async () => {
    const scope = createGuestScope('import-guest-scope');

    await importCalendarDays({
      scope,
      days: parseDays({
        days: [
          {
            date: '2026-07-26',
            items: [
              { text: 'Tarefa', category: { name: 'Foco', color: '#2563eb' } },
            ],
          },
        ],
      }),
      timezone,
    });

    const { items } = await getItemsForDate(scope.id, '2026-07-26');
    expect(supabaseMocks.getSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].syncStatus).toBe('local');
  });

  it('sends an authenticated import to Supabase with the account owner id', async () => {
    const scope = createUserScope('cloud-import-user');
    const accountClient = createAccountWriteClient();
    supabaseMocks.getSupabaseBrowserClient.mockReturnValue(
      accountClient.client,
    );

    await importCalendarDays({
      scope,
      days: parseDays({
        days: [
          {
            date: '2026-07-26',
            items: [
              { text: 'Tarefa', category: { name: 'Foco', color: '#2563eb' } },
            ],
          },
        ],
      }),
      timezone,
    });
    await waitForAccountPersistence(scope.id);

    expect(accountClient.writes.map((write) => write.table)).toEqual(
      expect.arrayContaining([
        'category_tags',
        'daily_entries',
        'checklist_items',
      ]),
    );
    expect(
      accountClient.writes.every(
        (write) => write.payload.user_id === scope.ownerId,
      ),
    ).toBe(true);

    const { items } = await getItemsForDate(scope.id, '2026-07-26');
    expect(items[0]).toMatchObject({
      scopeId: scope.id,
      syncStatus: 'synced',
    });
  });
});
