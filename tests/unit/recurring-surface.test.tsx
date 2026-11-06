import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGuestScope,
  type RecurrenceContent,
  type RecurrenceRule,
} from '@/lib/domain';
import {
  createCategoryTag,
  createRecurrence,
  db,
  pauseRecurrence,
  setRecurrenceResponse,
} from '@/lib/db';
import { RecurringSurface } from '@/features/recurring';
import { getDictionary } from '@/lib/i18n/dictionaries';

const today = '2026-11-06' as const;
const scope = createGuestScope('recurring-surface');

const dictionary = getDictionary('en');

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary,
    locale: 'en',
    scope,
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

const clock = vi.hoisted(() => ({ today: '2026-11-06' }));
const navigation = vi.hoisted(() => ({ search: '' }));

vi.mock('@/lib/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/time')>()),
  getTodayKey: () => clock.today,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const daily: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};

const content: RecurrenceContent = {
  text: 'Stretch',
  bold: false,
  priority: false,
  categoryTagId: null,
  children: [
    {
      id: 'child-1',
      parentId: null,
      text: 'Warm up',
      bold: false,
      priority: false,
      sortRank: 'a0',
    },
  ],
};

function daySection() {
  return screen.getByRole('region', { name: 'Day view' });
}

function overviewSection() {
  return screen.getByRole('region', { name: 'Activities' });
}

async function findActivity(name = 'Stretch') {
  return within(daySection()).findByRole('group', { name });
}

describe('RecurringSurface', () => {
  beforeEach(async () => {
    clock.today = '2026-11-06';
    navigation.search = '';
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    cleanup();
    await db.delete();
  });

  describe('loading and empty states', () => {
    it('explains the next step without activities', async () => {
      render(<RecurringSurface />);

      expect(
        await within(overviewSection()).findByText(
          dictionary.recurring.overviewEmpty,
        ),
      ).toBeTruthy();
      expect(
        within(daySection()).getByText(dictionary.recurring.dayEmpty),
      ).toBeTruthy();
    });

    it('announces the initial loading', () => {
      render(<RecurringSurface />);

      expect(
        screen.getAllByText(dictionary.recurring.loading).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('day view', () => {
    it('lists only what is scheduled on the selected date', async () => {
      await createRecurrence({
        scope,
        content: { ...content, text: 'First of month' },
        rule: { kind: 'monthly_day', day: 1 },
      });
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      await findActivity();

      expect(
        within(daySection()).queryByRole('group', { name: 'First of month' }),
      ).toBeNull();
    });

    it('records, swaps and clears an answer only on that date', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const activity = await findActivity();
      const done = within(activity).getByRole('button', {
        name: 'Done: Stretch',
      });
      const notDone = within(activity).getByRole('button', {
        name: 'Not done: Stretch',
      });

      fireEvent.click(done);
      await waitFor(() =>
        expect(done.getAttribute('aria-pressed')).toBe('true'),
      );

      fireEvent.click(notDone);
      await waitFor(() =>
        expect(notDone.getAttribute('aria-pressed')).toBe('true'),
      );
      expect(done.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(notDone);
      await waitFor(() =>
        expect(notDone.getAttribute('aria-pressed')).toBe('false'),
      );

      const rows = await db.recurrenceResponses
        .where('[scopeId+recurrenceId]')
        .equals([scope.id, id])
        .toArray();

      expect(rows).toHaveLength(1);
      expect(rows[0].date).toBe(today);
      expect(rows[0].deletedAt).not.toBeNull();
    });

    it('answers a child separately and shows it read-only', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const activity = await findActivity();

      expect(within(activity).queryByRole('textbox')).toBeNull();

      const childDone = within(activity).getByRole('button', {
        name: 'Done: Warm up',
      });
      fireEvent.click(childDone);

      await waitFor(() =>
        expect(childDone.getAttribute('aria-pressed')).toBe('true'),
      );
      expect(
        within(activity)
          .getByRole('button', { name: 'Done: Stretch' })
          .getAttribute('aria-pressed'),
      ).toBe('false');
    });

    it('collapses and expands the children', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const activity = await findActivity();
      fireEvent.click(
        within(activity).getAllByRole('button', {
          name: dictionary.dayEditor.collapseItem,
        })[0],
      );

      await waitFor(() =>
        expect(within(activity).queryByText('Warm up')).toBeNull(),
      );

      fireEvent.click(
        within(activity).getByRole('button', {
          name: dictionary.dayEditor.expandItem,
        }),
      );

      await within(activity).findByText('Warm up');
    });

    it('collapses a nested subtask on its own', async () => {
      await createRecurrence({
        scope,
        content: {
          ...content,
          children: [
            ...content.children,
            {
              id: 'grandchild',
              parentId: 'child-1',
              text: 'Neck',
              bold: false,
              priority: false,
              sortRank: 'a0',
            },
          ],
        },
        rule: daily,
      });
      render(<RecurringSurface />);

      const activity = await findActivity();

      await within(activity).findByText('Neck');
      fireEvent.click(
        within(activity).getAllByRole('button', {
          name: dictionary.dayEditor.collapseItem,
        })[1],
      );

      await waitFor(() =>
        expect(within(activity).queryByText('Neck')).toBeNull(),
      );
      expect(within(activity).getByText('Warm up')).toBeTruthy();

      fireEvent.click(
        within(activity).getByRole('button', {
          name: dictionary.dayEditor.expandItem,
        }),
      );
      await within(activity).findByText('Neck');
    });

    it('moves between days and returns to today', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      await findActivity();
      const section = daySection();

      fireEvent.click(
        within(section).getByRole('button', { name: 'Previous day' }),
      );
      await within(section).findByText(/November 5, 2026/);

      fireEvent.click(within(section).getByRole('button', { name: 'Today' }));
      await within(section).findByText(/November 6, 2026/);
    });

    it('keeps future dates visible but not answerable', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      await findActivity();
      fireEvent.click(
        within(daySection()).getByRole('button', { name: 'Next day' }),
      );

      await within(daySection()).findByText(dictionary.recurring.futureHint);

      const activity = await findActivity();
      const done = within(activity).getByRole('button', {
        name: 'Done: Stretch',
      }) as HTMLButtonElement;

      expect(done.disabled).toBe(true);
    });

    it('links to the daily tasks of the selected date', async () => {
      render(<RecurringSurface />);

      const link = within(daySection()).getByRole('link', {
        name: dictionary.recurring.openDailyTasks,
      });

      expect(link.getAttribute('href')).toBe(
        `/calendar?day=${today}&from=recurring`,
      );
    });

    it('opens on the date it returned to from the daily tasks', async () => {
      navigation.search = 'date=2026-10-20';
      render(<RecurringSurface />);

      await within(daySection()).findByText(/October 20, 2026/);
    });

    it.each(['2026-99-99', '2026-02-31', 'not-a-date'])(
      'ignores the invalid date %s in the address',
      async (date) => {
        navigation.search = `date=${date}`;
        render(<RecurringSurface />);

        await within(daySection()).findByText(/November 6, 2026/);
      },
    );

    it('follows the day turning while on today', async () => {
      render(<RecurringSurface />);

      await within(daySection()).findByText(/November 6, 2026/);

      clock.today = '2026-11-07';
      fireEvent(document, new Event('visibilitychange'));

      await within(daySection()).findByText(/November 7, 2026/);
    });

    it('keeps a chosen date when the day turns', async () => {
      render(<RecurringSurface />);

      fireEvent.click(
        within(daySection()).getByRole('button', { name: 'Previous day' }),
      );
      await within(daySection()).findByText(/November 5, 2026/);

      clock.today = '2026-11-07';
      fireEvent(document, new Event('visibilitychange'));

      await waitFor(() =>
        expect(
          within(daySection()).getByRole('button', { name: 'Today' }),
        ).toBeTruthy(),
      );
      expect(within(daySection()).getByText(/November 5, 2026/)).toBeTruthy();
    });

    it('only applies the picked date after confirming', async () => {
      render(<RecurringSurface />);

      const section = daySection();
      fireEvent.click(
        within(section).getByRole('button', {
          name: dictionary.recurring.chooseDate,
        }),
      );

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'November 20, 2026' }),
      );

      expect(within(section).queryByText(/November 20, 2026/)).toBeNull();

      fireEvent.click(
        within(dialog).getByRole('button', {
          name: dictionary.recurring.confirmDate,
        }),
      );

      await within(section).findByText(/November 20, 2026/);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('discards the picked date when cancelling', async () => {
      render(<RecurringSurface />);

      const section = daySection();
      fireEvent.click(
        within(section).getByRole('button', {
          name: dictionary.recurring.chooseDate,
        }),
      );

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'November 20, 2026' }),
      );
      fireEvent.click(
        within(dialog).getAllByRole('button', {
          name: dictionary.actions.cancel,
        })[0],
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(within(section).getByText(/November 6, 2026/)).toBeTruthy();
    });
  });

  describe('overview', () => {
    it('shows no data instead of zero without answers', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const overview = overviewSection();

      await within(overview).findByText('Stretch');
      expect(within(overview).getByText('No data')).toBeTruthy();
      expect(within(overview).getByText('Every day')).toBeTruthy();
    });

    it('counts the main answers and ignores the children', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });

      for (const [date, status, itemId] of [
        ['2026-11-01', 'done', null],
        ['2026-11-02', 'not_done', null],
        ['2026-11-03', 'done', 'child-1'],
      ] as const) {
        await setRecurrenceResponse({
          scope,
          recurrenceId: id,
          date,
          itemId,
          status,
          today,
        });
      }

      render(<RecurringSurface />);

      const overview = overviewSection();

      await within(overview).findByText('50% completed');
      expect(within(overview).getByText('1 done')).toBeTruthy();
      expect(within(overview).getByText('1 not done')).toBeTruthy();
    });

    it('pauses and reactivates an activity', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const overview = overviewSection();
      fireEvent.click(
        await within(overview).findByRole('button', {
          name: 'Pause: Stretch',
        }),
      );

      await within(overview).findByText('Paused · Every day');
      await waitFor(() =>
        expect(
          within(daySection()).queryByRole('group', { name: 'Stretch' }),
        ).toBeNull(),
      );

      fireEvent.click(
        within(overview).getByRole('button', { name: 'Reactivate: Stretch' }),
      );
      await within(overview).findByText('Every day');
    });

    it('states what deleting removes and requires confirmation', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      render(<RecurringSurface />);

      fireEvent.click(
        await within(overviewSection()).findByRole('button', {
          name: 'Delete: Stretch',
        }),
      );

      const dialog = await screen.findByRole('dialog');

      expect(within(dialog).getByText(/1 recorded answer/)).toBeTruthy();
      await expect(db.recurrences.get(id)).resolves.toMatchObject({
        deletedAt: null,
      });

      fireEvent.click(
        within(dialog).getByRole('button', {
          name: dictionary.actions.delete,
        }),
      );

      await waitFor(async () =>
        expect((await db.recurrences.get(id))?.deletedAt).not.toBeNull(),
      );
    });
  });

  describe('editor', () => {
    function openCreate() {
      fireEvent.click(
        within(overviewSection()).getByRole('button', {
          name: dictionary.recurring.newActivity,
        }),
      );

      return screen.findByRole('dialog');
    }

    async function openEdit() {
      fireEvent.click(
        await within(overviewSection()).findByRole('button', {
          name: 'Edit: Stretch',
        }),
      );

      return screen.findByRole('dialog');
    }

    function save(dialog: HTMLElement) {
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: dictionary.recurring.save,
        }),
      );
    }

    it('assigns a category of its own surface', async () => {
      const category = await createCategoryTag({
        scope,
        surface: 'recurrence',
        name: 'Health',
        colorHex: '#2563eb',
      });
      render(<RecurringSurface />);

      const dialog = await openCreate();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Categorized' } },
      );

      const trigger = await within(dialog).findByRole('button', {
        name: dictionary.dayEditor.assignCategory,
      });

      await waitFor(() =>
        expect((trigger as HTMLButtonElement).disabled).toBe(false),
      );
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByRole('button', { name: /HEALTH/i }));
      save(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await expect(db.recurrences.toArray()).resolves.toMatchObject([
        { categoryTagId: category.id },
      ]);
    });

    it('offers managing categories inside the editor', async () => {
      render(<RecurringSurface />);

      const dialog = await openCreate();

      expect(
        within(dialog).getByRole('button', {
          name: dictionary.navigation.categories,
        }),
      ).toBeTruthy();
    });

    it('names the subtask action', async () => {
      await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const dialog = await openEdit();

      expect(
        within(dialog).getByRole('button', {
          name: dictionary.recurring.addSubtask,
        }),
      ).toBeTruthy();
    });

    it('requires a name', async () => {
      render(<RecurringSurface />);

      const dialog = await openCreate();
      save(dialog);

      await within(dialog).findByText(dictionary.recurring.nameRequired);
      await expect(db.recurrences.count()).resolves.toBe(0);
    });

    it('creates a weekly activity on the chosen weekdays', async () => {
      render(<RecurringSurface />);

      const dialog = await openCreate();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Run' } },
      );
      fireEvent.click(
        within(dialog).getByRole('radio', {
          name: dictionary.recurring.kindWeekly,
        }),
      );
      save(dialog);

      await within(dialog).findByText(dictionary.recurring.errorWeekdays);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Mon' }));
      save(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      const [recurrence] = await db.recurrences.toArray();

      expect(recurrence.text).toBe('Run');
      expect(recurrence.schedule).toEqual([
        {
          from: null,
          rule: {
            kind: 'weekly',
            everyWeeks: 1,
            weekdays: [1],
            anchorDate: null,
          },
        },
      ]);
    });

    it('does not ask how to apply without answers', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });
      render(<RecurringSurface />);

      const dialog = await openEdit();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Renamed' } },
      );
      save(dialog);

      await waitFor(async () =>
        expect((await db.recurrences.get(id))?.text).toBe('Renamed'),
      );
      expect(screen.queryByText(dictionary.recurring.applyTitle)).toBeNull();
    });

    it('does not ask how to apply when only the frequency changes', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });
      await setRecurrenceResponse({
        scope,
        recurrenceId: id,
        date: today,
        itemId: null,
        status: 'done',
        today,
      });
      render(<RecurringSurface />);

      const dialog = await openEdit();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.everyDaysLabel),
        { target: { value: '2' } },
      );
      save(dialog);

      await waitFor(async () =>
        expect((await db.recurrences.get(id))?.schedule).toHaveLength(2),
      );
      expect(screen.queryByText(dictionary.recurring.applyTitle)).toBeNull();
    });

    it.each([
      ['applyAll', 'Renamed', 0],
      ['applyForward', 'Stretch', 1],
    ] as const)(
      'asks how to apply with answers: %s',
      async (option, past, history) => {
        const { id } = await createRecurrence({ scope, content, rule: daily });
        await setRecurrenceResponse({
          scope,
          recurrenceId: id,
          date: '2026-11-01',
          itemId: null,
          status: 'done',
          today,
        });
        render(<RecurringSurface />);

        const dialog = await openEdit();
        fireEvent.change(
          within(dialog).getByLabelText(dictionary.recurring.nameLabel),
          { target: { value: 'Renamed' } },
        );
        save(dialog);

        fireEvent.click(
          await screen.findByRole('button', {
            name: dictionary.recurring[option],
          }),
        );

        await waitFor(async () =>
          expect((await db.recurrences.get(id))?.text).toBe('Renamed'),
        );

        const updated = await db.recurrences.get(id);

        expect(updated?.contentHistory).toHaveLength(history);
        expect(updated?.contentHistory[0]?.text ?? 'Renamed').toBe(past);
      },
    );

    it.each([
      [
        'the last day of the month',
        'monthlyLastDay',
        [],
        { kind: 'monthly_last_day' },
      ],
      ['a specific day', 'monthlyDay', [], { kind: 'monthly_day', day: 6 }],
      [
        'a weekday by position',
        'monthlyWeekday',
        [
          ['Position in the month', 'Last'],
          ['Weekdays', 'Mon'],
        ],
        { kind: 'monthly_weekday', ordinal: 'last', weekday: 1 },
      ],
    ] as const)(
      'creates a monthly activity on %s',
      async (_label, mode, picks, rule) => {
        render(<RecurringSurface />);

        const dialog = await openCreate();
        fireEvent.change(
          within(dialog).getByLabelText(dictionary.recurring.nameLabel),
          { target: { value: 'Monthly' } },
        );
        fireEvent.click(
          within(dialog).getByRole('radio', {
            name: dictionary.recurring.kindMonthly,
          }),
        );
        fireEvent.click(
          within(dialog).getByRole('radio', {
            name: dictionary.recurring[mode],
          }),
        );

        for (const [group, option] of picks) {
          fireEvent.click(
            within(
              within(dialog).getByRole('radiogroup', { name: group }),
            ).getByRole('radio', { name: option }),
          );
        }

        save(dialog);

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        const [recurrence] = await db.recurrences.toArray();

        expect(recurrence.schedule[0].rule).toEqual(rule);
      },
    );

    it('rejects an out of range day and keeps only digits', async () => {
      render(<RecurringSurface />);

      const dialog = await openCreate();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Monthly' } },
      );
      fireEvent.click(
        within(dialog).getByRole('radio', {
          name: dictionary.recurring.kindMonthly,
        }),
      );

      const day = within(dialog).getByLabelText(
        dictionary.recurring.dayOfMonthLabel,
      ) as HTMLInputElement;

      fireEvent.change(day, { target: { value: '4a5' } });
      expect(day.value).toBe('45');

      save(dialog);

      await within(dialog).findByText(dictionary.recurring.errorDay);
      await expect(db.recurrences.count()).resolves.toBe(0);
    });

    it('only asks for the reference week above one week', async () => {
      render(<RecurringSurface />);

      const dialog = await openCreate();
      fireEvent.click(
        within(dialog).getByRole('radio', {
          name: dictionary.recurring.kindWeekly,
        }),
      );

      expect(
        within(dialog).queryByLabelText(dictionary.recurring.anchorLabel),
      ).toBeNull();

      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.everyWeeksLabel),
        { target: { value: '2' } },
      );

      const anchor = within(dialog).getByLabelText(
        dictionary.recurring.anchorLabel,
      );

      fireEvent.change(anchor, { target: { value: '' } });
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Biweekly' } },
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Tue' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Mon' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Tue' }));
      save(dialog);

      await within(dialog).findByText(dictionary.recurring.errorAnchor);

      fireEvent.change(anchor, { target: { value: '02-11-2026' } });
      save(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      const [recurrence] = await db.recurrences.toArray();

      expect(recurrence.schedule[0].rule).toEqual({
        kind: 'weekly',
        everyWeeks: 2,
        weekdays: [1],
        anchorDate: '2026-11-02',
      });
    });

    it('applies the bold and priority formatting', async () => {
      render(<RecurringSurface />);

      const dialog = await openCreate();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Formatted' } },
      );
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: dictionary.recurring.bold,
        }),
      );
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: dictionary.recurring.priority,
        }),
      );
      save(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await expect(db.recurrences.toArray()).resolves.toMatchObject([
        { bold: true, priority: true },
      ]);
    });

    it('keeps the editor open when saving fails', async () => {
      const failure = vi
        .spyOn(db.recurrences, 'add')
        .mockRejectedValueOnce(new Error('storage unavailable'));
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<RecurringSurface />);

      const dialog = await openCreate();
      fireEvent.change(
        within(dialog).getByLabelText(dictionary.recurring.nameLabel),
        { target: { value: 'Fails' } },
      );
      save(dialog);

      await waitFor(() => expect(failure).toHaveBeenCalled());
      await waitFor(() => expect(logged).toHaveBeenCalled());

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(
        (
          within(dialog).getByRole('button', {
            name: dictionary.recurring.save,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);

      failure.mockRestore();
      logged.mockRestore();
    });

    it('locks the frequency of a paused activity', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });
      await pauseRecurrence({ scope, recurrenceId: id, today });
      render(<RecurringSurface />);

      const dialog = await openEdit();

      expect(
        within(dialog).getByText(dictionary.recurring.pausedFrequencyHint),
      ).toBeTruthy();
      expect(
        (
          within(dialog).getByLabelText(
            dictionary.recurring.everyDaysLabel,
          ) as HTMLInputElement
        ).disabled,
      ).toBe(true);
    });
  });
});
