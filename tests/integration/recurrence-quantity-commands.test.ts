import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGuestScope,
  getContentAt,
  type RecurrenceChild,
  type RecurrenceContent,
  type RecurrenceRule,
} from '@/lib/domain';
import {
  createRecurrence,
  db,
  setRecurrenceQuantity,
  setRecurrenceResponse,
  updateRecurrence,
} from '@/lib/db';

const { remoteClient } = vi.hoisted(() => ({
  remoteClient: vi.fn(() => {
    throw new Error('Guest must not initialize remote persistence.');
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: remoteClient,
}));

const scope = createGuestScope('recurrence-quantity');
const today = '2026-11-10' as const;
const daily: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};
const pages = { target: 20, unit: 'páginas' };
const reading: RecurrenceContent = {
  text: 'Ler',
  bold: false,
  priority: false,
  categoryTagId: null,
  children: [],
  measure: pages,
};

function leaf(overrides: Partial<RecurrenceChild> = {}): RecurrenceChild {
  return {
    id: 'stretch',
    parentId: null,
    text: 'Alongar',
    bold: false,
    priority: false,
    sortRank: 'a0',
    measure: { target: 10, unit: 'minutos' },
    ...overrides,
  };
}

function record(
  recurrenceId: string,
  value: number | null,
  {
    date = today,
    itemId = null,
  }: { date?: string; itemId?: string | null } = {},
) {
  return setRecurrenceQuantity({
    date: date as typeof today,
    itemId,
    recurrenceId,
    scope,
    today,
    value,
  });
}

async function rootResponse(recurrenceId: string, date: string = today) {
  return db.recurrenceResponses.get(
    `rr:${scope.id}:${recurrenceId}:${date}:root`,
  );
}

describe('quantitative recurrence commands', () => {
  beforeEach(async () => {
    remoteClient.mockClear();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('stores the measure and normalizes the unit', async () => {
    const recurrence = await createRecurrence({
      scope,
      content: { ...reading, measure: { target: 20, unit: '  páginas  ' } },
      rule: daily,
    });

    expect(recurrence.measure).toEqual(pages);
  });

  it.each([
    [{ target: 0, unit: 'km' }],
    [{ target: 5, unit: ' ' }],
    [{ target: -2, unit: 'km' }],
  ])('rejects the invalid measure %j', async (measure) => {
    await expect(
      createRecurrence({
        scope,
        content: { ...reading, measure },
        rule: daily,
      }),
    ).rejects.toThrow('invalid_recurrence_measure');
  });

  it('rejects a measure on an item that has subtasks', async () => {
    await expect(
      createRecurrence({
        scope,
        content: { ...reading, children: [leaf()] },
        rule: daily,
      }),
    ).rejects.toThrow('invalid_recurrence_measure');
    await expect(
      createRecurrence({
        scope,
        content: {
          ...reading,
          measure: null,
          children: [
            leaf({ id: 'group' }),
            leaf({ id: 'inner', parentId: 'group', measure: null }),
          ],
        },
        rule: daily,
      }),
    ).rejects.toThrow('invalid_recurrence_measure');
  });

  it('writes every subtask with an explicit measure key', async () => {
    const recurrence = await createRecurrence({
      scope,
      content: {
        ...reading,
        measure: null,
        children: [leaf(), leaf({ id: 'tidy', measure: undefined })],
      },
      rule: daily,
    });

    expect(recurrence.children.map((child) => child.measure)).toEqual([
      { target: 10, unit: 'minutos' },
      null,
    ]);
    expect(Object.hasOwn(recurrence.children[1], 'measure')).toBe(true);
  });

  it('records a total that replaces the previous one during the day', async () => {
    const { id } = await createRecurrence({
      scope,
      content: reading,
      rule: daily,
    });

    await expect(record(id, 5)).resolves.toBe(true);
    await expect(record(id, 12)).resolves.toBe(true);

    expect(await rootResponse(id)).toMatchObject({
      quantity: { ...pages, value: 12 },
      status: 'not_done',
      deletedAt: null,
    });

    await record(id, 25);

    expect(await rootResponse(id)).toMatchObject({
      quantity: { ...pages, value: 25 },
      status: 'done',
    });
    await expect(db.recurrenceResponses.count()).resolves.toBe(1);
  });

  it('records zero apart from clearing the answer', async () => {
    const { id } = await createRecurrence({
      scope,
      content: reading,
      rule: daily,
    });

    await record(id, 0);

    expect(await rootResponse(id)).toMatchObject({
      quantity: { ...pages, value: 0 },
      status: 'not_done',
      deletedAt: null,
    });

    await record(id, null);

    expect((await rootResponse(id))?.deletedAt).not.toBeNull();

    await record(id, 7.5);

    expect(await rootResponse(id)).toMatchObject({
      quantity: { ...pages, value: 7.5 },
      deletedAt: null,
    });
  });

  it('rejects invalid values, future dates and binary items', async () => {
    const quantitative = await createRecurrence({
      scope,
      content: reading,
      rule: daily,
    });
    const binary = await createRecurrence({
      scope,
      content: { ...reading, measure: null },
      rule: daily,
    });

    await expect(record(quantitative.id, -1)).resolves.toBe(false);
    await expect(record(quantitative.id, Number.NaN)).resolves.toBe(false);
    await expect(
      record(quantitative.id, 5, { date: '2026-11-11' }),
    ).resolves.toBe(false);
    await expect(record(binary.id, 5)).resolves.toBe(false);
    await expect(
      setRecurrenceResponse({
        date: today,
        itemId: null,
        recurrenceId: quantitative.id,
        scope,
        status: 'done',
        today,
      }),
    ).resolves.toBe(false);
    await expect(db.recurrenceResponses.count()).resolves.toBe(0);
  });

  it('records a measured subtask on its own', async () => {
    const { id } = await createRecurrence({
      scope,
      content: { ...reading, measure: null, children: [leaf()] },
      rule: daily,
    });

    await record(id, 7, { itemId: 'stretch' });

    await expect(
      db.recurrenceResponses.get(`rr:${scope.id}:${id}:${today}:stretch`),
    ).resolves.toMatchObject({
      quantity: { target: 10, unit: 'minutos', value: 7 },
      status: 'not_done',
    });
    await expect(rootResponse(id)).resolves.toBeUndefined();
  });

  it('applies a new target from the next day when answers exist', async () => {
    const { id } = await createRecurrence({
      scope,
      content: reading,
      rule: daily,
    });

    await record(id, 20, { date: '2026-11-09' });
    await updateRecurrence({
      scope,
      recurrenceId: id,
      content: { ...reading, measure: { target: 30, unit: 'páginas' } },
      today,
    });

    const updated = await db.recurrences.get(id);

    expect(getContentAt(updated!, today).measure).toEqual(pages);
    expect(getContentAt(updated!, '2026-11-11').measure).toEqual({
      target: 30,
      unit: 'páginas',
    });
    expect((await rootResponse(id, '2026-11-09'))?.quantity).toEqual({
      ...pages,
      value: 20,
    });

    await record(id, 25);

    expect(await rootResponse(id)).toMatchObject({
      quantity: { ...pages, value: 25 },
      status: 'done',
    });
  });

  it('keeps old binary answers when the activity starts measuring', async () => {
    const { id } = await createRecurrence({
      scope,
      content: { ...reading, measure: null },
      rule: daily,
    });

    await setRecurrenceResponse({
      date: '2026-11-09',
      itemId: null,
      recurrenceId: id,
      scope,
      status: 'done',
      today,
    });
    await updateRecurrence({
      scope,
      recurrenceId: id,
      content: reading,
      today,
    });

    expect(await rootResponse(id, '2026-11-09')).toMatchObject({
      status: 'done',
    });
    expect((await rootResponse(id, '2026-11-09'))?.quantity ?? null).toBeNull();
    await expect(record(id, 5)).resolves.toBe(false);
    await expect(record(id, 5, { date: '2026-11-11' })).resolves.toBe(false);
  });

  it('removes a subtask measure explicitly', async () => {
    const { id } = await createRecurrence({
      scope,
      content: { ...reading, measure: null, children: [leaf()] },
      rule: daily,
    });

    await updateRecurrence({
      scope,
      recurrenceId: id,
      content: {
        ...reading,
        measure: null,
        children: [leaf({ measure: null })],
      },
      today,
    });

    const [stored] = (await db.recurrences.get(id))!.children;

    expect(stored.measure).toBeNull();
    expect(Object.hasOwn(stored, 'measure')).toBe(true);
  });
});
