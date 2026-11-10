import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGuestScope,
  getContentAt,
  getRuleAt,
  isRecurrencePaused,
  type RecurrenceChild,
  type RecurrenceContent,
  type RecurrenceRule,
} from '@/lib/domain';
import {
  createCategoryTag,
  createRecurrence,
  db,
  pauseRecurrence,
  resumeRecurrence,
  setRecurrenceResponse,
  softDeleteCategoryTag,
  softDeleteRecurrence,
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

const scope = createGuestScope('recurrence-commands');
const today = '2026-11-06' as const;

const daily: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};

const mondays: RecurrenceRule = {
  kind: 'weekly',
  everyWeeks: 1,
  weekdays: [1],
  anchorDate: null,
};

const child: RecurrenceChild = {
  id: 'child-1',
  parentId: null,
  text: 'Child',
  bold: true,
  priority: false,
  sortRank: 'a0',
};

const content: RecurrenceContent = {
  text: 'Stretch',
  bold: false,
  priority: false,
  categoryTagId: null,
  children: [],
};

function create(overrides: Partial<RecurrenceContent> = {}) {
  return createRecurrence({
    scope,
    content: { ...content, ...overrides },
    rule: daily,
  });
}

function listResponses(recurrenceId: string) {
  return db.recurrenceResponses
    .where('[scopeId+recurrenceId]')
    .equals([scope.id, recurrenceId])
    .toArray();
}

describe('recurrence commands', () => {
  beforeEach(async () => {
    remoteClient.mockClear();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('createRecurrence', () => {
    it('stores one definition that applies to the whole past', async () => {
      const recurrence = await create({ children: [child] });

      expect(recurrence.syncStatus).toBe('local');
      expect(recurrence.schedule).toEqual([{ from: null, rule: daily }]);
      expect(recurrence.children).toEqual([{ ...child, measure: null }]);
      expect(recurrence.contentHistory).toEqual([]);
      await expect(db.recurrences.count()).resolves.toBe(1);
      await expect(db.recurrenceResponses.count()).resolves.toBe(0);
    });

    it('rejects an invalid rule and a blank name', async () => {
      await expect(
        createRecurrence({
          scope,
          content,
          rule: { kind: 'monthly_day', day: 40 },
        }),
      ).rejects.toThrow('invalid_recurrence_rule');
      await expect(create({ text: '   ' })).rejects.toThrow(
        'invalid_recurrence_text',
      );
      await expect(db.recurrences.count()).resolves.toBe(0);
    });

    it('accepts only categories of its own surface', async () => {
      const own = await createCategoryTag({
        scope,
        name: 'Own',
        surface: 'recurrence',
        colorHex: '#2563eb',
      });
      const foreign = await createCategoryTag({
        scope,
        name: 'Foreign',
        surface: 'checklist_item',
        colorHex: '#2563eb',
      });

      expect((await create({ categoryTagId: own.id })).categoryTagId).toBe(
        own.id,
      );
      expect(
        (await create({ categoryTagId: foreign.id })).categoryTagId,
      ).toBeNull();
    });
  });

  describe('setRecurrenceResponse', () => {
    it('records one answer per date without touching other dates', async () => {
      const { id } = await create();

      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: '2026-11-05',
        itemId: null,
        status: 'not_done',
        today,
      });
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        status: 'not_done',
        today,
      });

      const responses = await listResponses(id);

      expect(responses).toHaveLength(2);
      expect(responses.find((row) => row.date === today)?.status).toBe(
        'not_done',
      );
      expect(responses.find((row) => row.date === '2026-11-05')?.status).toBe(
        'not_done',
      );
    });

    it('returns to pending and restores the same row', async () => {
      const { id } = await create();
      const answer = {
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        today,
      };

      await setRecurrenceResponse({ ...answer, status: 'done' });
      await setRecurrenceResponse({ ...answer, status: null });

      const [cleared] = await listResponses(id);
      expect(cleared.deletedAt).not.toBeNull();

      await setRecurrenceResponse({ ...answer, status: 'not_done' });

      const responses = await listResponses(id);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        id: cleared.id,
        deletedAt: null,
        status: 'not_done',
      });
    });

    it('answers a child separately from the activity', async () => {
      const { id } = await create({ children: [child] });

      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: child.id,
        status: 'done',
        today,
      });

      const responses = await listResponses(id);

      expect(responses).toHaveLength(1);
      expect(responses[0].itemId).toBe(child.id);
    });

    it.each([
      ['a future date', { date: '2026-11-07' }],
      ['an impossible date', { date: '2026-02-31' }],
      ['an unknown child', { itemId: 'unknown' }],
      ['an unknown recurrence', { recurrenceId: 'unknown' }],
    ])('refuses %s', async (_label, overrides) => {
      const { id } = await create();

      await expect(
        setRecurrenceResponse({
          scope,
          recurrenceId: id,
          date: today,
          itemId: null,
          status: 'done',
          today,
          ...(overrides as object),
        }),
      ).resolves.toBe(false);
      await expect(db.recurrenceResponses.count()).resolves.toBe(0);
    });

    it('refuses a date the schedule does not predict', async () => {
      const recurrence = await createRecurrence({
        scope,
        content,
        rule: mondays,
      });

      await expect(
        setRecurrenceResponse({
          scope,
          recurrenceId: recurrence.id,
          date: today,
          itemId: null,
          status: 'done',
          today,
        }),
      ).resolves.toBe(false);
    });

    it('still allows changing an answer the schedule no longer predicts', async () => {
      const { id } = await create();
      const answer = {
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        today,
      };

      await setRecurrenceResponse({ ...answer, status: 'done' });
      await pauseRecurrence({ scope, recurrenceId: id, today });

      await expect(
        setRecurrenceResponse({ ...answer, status: 'not_done' }),
      ).resolves.toBe(true);
    });

    it('does not cross scopes', async () => {
      const { id } = await create();

      await expect(
        setRecurrenceResponse({
          scope: createGuestScope('other-installation'),
          recurrenceId: id,
          date: today,
          itemId: null,
          status: 'done',
          today,
        }),
      ).resolves.toBe(false);
    });
  });

  describe('updateRecurrence', () => {
    it('changes the frequency only from today on', async () => {
      const { id } = await create();

      await updateRecurrence({
        scope,
        recurrenceId: id,
        rule: mondays,
        today,
      });

      const updated = await db.recurrences.get(id);

      expect(getRuleAt(updated!.schedule, '2026-11-05')).toEqual(daily);
      expect(getRuleAt(updated!.schedule, today)).toEqual(mondays);
    });

    it('updates past answers in place when applying to all', async () => {
      const { id } = await create();
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: '2026-11-01',
        itemId: null,
        status: 'done',
        today,
      });

      await updateRecurrence({
        scope,
        recurrenceId: id,
        content: { ...content, text: 'Renamed' },
        contentMode: 'all',
        today,
      });

      const updated = await db.recurrences.get(id);

      expect(getContentAt(updated!, '2026-11-01').text).toBe('Renamed');
      expect(updated!.contentHistory).toEqual([]);
      expect((await listResponses(id))[0]).toMatchObject({
        date: '2026-11-01',
        status: 'done',
      });
    });

    it('keeps past content when applying forward', async () => {
      const { id } = await create();
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: '2026-11-01',
        itemId: null,
        status: 'done',
        today,
      });

      await updateRecurrence({
        scope,
        recurrenceId: id,
        content: { ...content, text: 'Renamed' },
        contentMode: 'forward',
        today,
      });

      const updated = await db.recurrences.get(id);

      expect(getContentAt(updated!, '2026-11-01').text).toBe('Stretch');
      expect(getContentAt(updated!, today).text).toBe('Renamed');
    });

    it('keeps content already answered today when applying forward', async () => {
      const { id } = await create();
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });

      await updateRecurrence({
        scope,
        recurrenceId: id,
        content: { ...content, text: 'Renamed' },
        contentMode: 'forward',
        today,
      });

      const updated = await db.recurrences.get(id);

      expect(getContentAt(updated!, today).text).toBe('Stretch');
      expect(getContentAt(updated!, '2026-11-07').text).toBe('Renamed');
    });

    it('keeps the frequency of a paused recurrence', async () => {
      const { id } = await create();
      await pauseRecurrence({ scope, recurrenceId: id, today });

      await updateRecurrence({
        scope,
        recurrenceId: id,
        rule: mondays,
        today: '2026-11-08',
      });

      const updated = await db.recurrences.get(id);

      expect(isRecurrencePaused(updated!.schedule)).toBe(true);
      expect(updated!.schedule.at(-1)?.from).toBe(today);
    });
  });

  describe('pause and resume', () => {
    it('stops new occurrences and keeps the history', async () => {
      const { id } = await create();
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: '2026-11-01',
        itemId: null,
        status: 'done',
        today,
      });

      await pauseRecurrence({ scope, recurrenceId: id, today });

      const paused = await db.recurrences.get(id);
      expect(isRecurrencePaused(paused!.schedule)).toBe(true);
      expect(getRuleAt(paused!.schedule, '2026-11-05')).toEqual(daily);
      expect(getRuleAt(paused!.schedule, today)).toBeNull();
      expect(await listResponses(id)).toHaveLength(1);

      await resumeRecurrence({
        scope,
        recurrenceId: id,
        today: '2026-11-10',
      });

      const resumed = await db.recurrences.get(id);
      expect(isRecurrencePaused(resumed!.schedule)).toBe(false);
      expect(getRuleAt(resumed!.schedule, '2026-11-09')).toBeNull();
      expect(getRuleAt(resumed!.schedule, '2026-11-10')).toEqual(daily);
    });
  });

  describe('softDeleteRecurrence', () => {
    it('removes the definition and every answer', async () => {
      const { id } = await create({ children: [child] });
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: child.id,
        status: 'done',
        today,
      });

      await softDeleteRecurrence({ scope, recurrenceId: id });

      const deleted = await db.recurrences.get(id);
      const responses = await listResponses(id);

      expect(deleted?.deletedAt).not.toBeNull();
      expect(responses).toHaveLength(2);
      expect(responses.every((row) => row.deletedAt !== null)).toBe(true);
    });
  });

  describe('category removal', () => {
    it('clears the category from the current and the past content', async () => {
      const category = await createCategoryTag({
        scope,
        name: 'Health',
        surface: 'recurrence',
        colorHex: '#2563eb',
      });
      const { id } = await create({ categoryTagId: category.id });

      await updateRecurrence({
        scope,
        recurrenceId: id,
        content: { ...content, text: 'Renamed', categoryTagId: category.id },
        contentMode: 'forward',
        today,
      });
      await softDeleteCategoryTag({ scope, categoryTagId: category.id });

      const updated = await db.recurrences.get(id);

      expect(updated?.categoryTagId).toBeNull();
      expect(updated?.contentHistory[0].categoryTagId).toBeNull();
    });
  });

  it('never touches the remote client for a guest', async () => {
    const { id } = await create();

    await setRecurrenceResponse({
      scope,
      recurrenceId: id,
      date: today,
      itemId: null,
      status: 'done',
      today,
    });
    await softDeleteRecurrence({ scope, recurrenceId: id });

    expect(remoteClient).not.toHaveBeenCalled();
  });
});
