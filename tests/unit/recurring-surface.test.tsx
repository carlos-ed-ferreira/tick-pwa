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
const composition = vi.hoisted(() => ({ touch: false }));

vi.mock('@/hooks/use-touch-composition', () => ({
  touchCompositionQuery: '',
  useTouchComposition: () => composition.touch,
}));

vi.mock('@/lib/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/time')>()),
  getTodayKey: () => clock.today,
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

async function renderSurface() {
  render(<RecurringSurface />);
  await screen.findByRole('region', { name: /^(Activities|Day view)$/ });
}

function showView(name: string, tab: string) {
  const current = screen.queryByRole('region', { name });

  if (current) {
    return current;
  }

  fireEvent.click(screen.getByRole('button', { name: tab }));

  return screen.getByRole('region', { name });
}

function daySection() {
  return showView('Day view', dictionary.recurring.viewExecute);
}

function overviewSection() {
  return showView('Activities', dictionary.recurring.viewManage);
}

async function chooseAction(action: string, name = 'Stretch') {
  fireEvent.click(
    await within(overviewSection()).findByRole('button', {
      name: `More actions: ${name}`,
    }),
  );
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
}

async function findActivity(name = 'Stretch') {
  return within(daySection()).findByRole('group', { name });
}

describe('RecurringSurface', () => {
  beforeEach(async () => {
    clock.today = '2026-11-06';
    composition.touch = false;
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    cleanup();
    await db.delete();
  });

  describe('loading and empty states', () => {
    it('shows only the large create action without activities', async () => {
      await renderSurface();

      const create = within(overviewSection()).getByRole('button', {
        name: dictionary.recurring.emptyCreate,
      });

      expect(screen.queryByRole('region', { name: 'Day view' })).toBeNull();
      expect(
        within(overviewSection()).queryByRole('button', {
          name: dictionary.recurring.newActivity,
        }),
      ).toBeNull();
      expect(
        within(overviewSection()).getByRole('button', {
          name: dictionary.navigation.categories,
        }),
      ).toBeTruthy();

      fireEvent.click(create);

      expect(await screen.findByRole('dialog')).toBeTruthy();
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
      await renderSurface();

      await findActivity();

      expect(
        within(daySection()).queryByRole('group', { name: 'First of month' }),
      ).toBeNull();
    });

    it('records, swaps and clears an answer only on that date', async () => {
      const { id } = await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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

    it('keeps every activity in one container', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await createRecurrence({
        scope,
        content: { ...content, text: 'Read', children: [] },
        rule: daily,
      });
      await renderSurface();

      const panel =
        await within(daySection()).findByTestId('task-list-surface');

      expect(
        within(panel).getByRole('group', { name: 'Stretch' }),
      ).toBeTruthy();
      expect(within(panel).getByRole('group', { name: 'Read' })).toBeTruthy();
      expect(panel.querySelector('.card-surface-soft')).toBeNull();
    });

    it('shows the empty message inside the container', async () => {
      await createRecurrence({
        scope,
        content,
        rule: { kind: 'monthly_day', day: 1 },
      });
      await renderSurface();

      const panel =
        await within(daySection()).findByTestId('task-list-surface');

      expect(
        within(panel).getByText(dictionary.recurring.dayEmpty),
      ).toBeTruthy();
    });

    it('moves between days and returns to today', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      await findActivity();
      const section = daySection();

      fireEvent.click(
        within(section).getByRole('button', { name: 'Previous day' }),
      );
      await within(section).findByText(/November 5, 2026/);

      fireEvent.click(
        within(section).getByRole('button', {
          name: dictionary.recurring.chooseDate,
        }),
      );
      fireEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Today',
        }),
      );
      await within(section).findByText(/November 6, 2026/);
    });

    it('keeps future dates visible but not answerable', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

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

    it('follows the day turning while on today', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      await within(daySection()).findByText(/November 6, 2026/);

      clock.today = '2026-11-07';
      fireEvent(document, new Event('visibilitychange'));

      await within(daySection()).findByText(/November 7, 2026/);
    });

    it('keeps a chosen date when the day turns', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      fireEvent.click(
        within(daySection()).getByRole('button', { name: 'Previous day' }),
      );
      await within(daySection()).findByText(/November 5, 2026/);

      clock.today = '2026-11-07';
      fireEvent(document, new Event('visibilitychange'));

      expect(within(daySection()).getByText(/November 5, 2026/)).toBeTruthy();
    });

    it('applies the picked date at once, without a modal or confirmation', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const section = daySection();

      fireEvent.click(
        within(section).getByRole('button', {
          name: dictionary.recurring.chooseDate,
        }),
      );

      const picker = await screen.findByRole('dialog');

      expect(picker.getAttribute('aria-modal')).toBeNull();
      expect(
        within(picker).queryByRole('button', { name: 'Confirm' }),
      ).toBeNull();

      fireEvent.click(
        within(picker).getByRole('button', { name: 'November 20, 2026' }),
      );

      await within(section).findByText(/November 20, 2026/);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the picker with Escape keeping the date', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const section = daySection();

      fireEvent.click(
        within(section).getByRole('button', {
          name: dictionary.recurring.chooseDate,
        }),
      );
      await screen.findByRole('dialog');
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(within(section).getByText(/November 6, 2026/)).toBeTruthy();
    });

    it('offers the date picker after the day, and no separate today button', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const section = daySection();

      expect(
        within(section)
          .getByRole('button', { name: 'Next day' })
          .compareDocumentPosition(
            within(section).getByRole('button', {
              name: dictionary.recurring.chooseDate,
            }),
          ),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(
        within(section).queryByRole('button', { name: 'Today' }),
      ).toBeNull();
    });
  });

  describe('overview', () => {
    it('shows no data instead of zero without answers', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

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

      await renderSurface();

      const overview = overviewSection();

      await within(overview).findByText('50%');
      expect(within(overview).getByText('1 done')).toBeTruthy();
      expect(within(overview).getByText('1 not done')).toBeTruthy();
      expect(
        within(overview)
          .getByRole('progressbar', { name: 'Completion rate: Stretch' })
          .getAttribute('aria-valuenow'),
      ).toBe('50');
    });

    it('has no progress value without answers', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const overview = overviewSection();

      await within(overview).findByText('No data');
      expect(within(overview).queryByRole('progressbar')).toBeNull();
    });

    it('pauses and reactivates an activity from the menu', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      await chooseAction(dictionary.recurring.actionPause);
      await within(overviewSection()).findByText('Paused · Every day');
      expect(screen.queryByRole('menu')).toBeNull();

      expect(
        within(daySection()).queryByRole('group', { name: 'Stretch' }),
      ).toBeNull();

      await chooseAction(dictionary.recurring.actionResume);
      await within(overviewSection()).findByText('Every day');
    });

    it('closes the menu with Escape and returns the focus', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const trigger = await within(overviewSection()).findByRole('button', {
        name: 'More actions: Stretch',
      });

      fireEvent.click(trigger);

      const items = await screen.findAllByRole('menuitem');

      await waitFor(() => expect(document.activeElement).toBe(items[0]));
      fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[1]);
      fireEvent.keyDown(items[1], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(items[0], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[2]);

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(trigger);
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
      await renderSurface();

      await chooseAction(dictionary.recurring.actionDelete);

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

  describe('actions on touch', () => {
    async function openSheet() {
      composition.touch = true;
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();
      fireEvent.click(
        await within(overviewSection()).findByRole('button', {
          name: 'More actions: Stretch',
        }),
      );

      return screen.findByRole('dialog');
    }

    it('offers the same actions in a sheet instead of a menu', async () => {
      const sheet = await openSheet();

      expect(screen.queryByRole('menu')).toBeNull();

      for (const action of [
        dictionary.recurring.actionEdit,
        dictionary.recurring.actionPause,
        dictionary.recurring.actionDelete,
      ]) {
        expect(
          within(sheet).getByRole('button', { name: action }),
        ).toBeTruthy();
      }
    });

    it('closes the sheet and runs the chosen action', async () => {
      const sheet = await openSheet();

      fireEvent.click(
        within(sheet).getByRole('button', {
          name: dictionary.recurring.actionPause,
        }),
      );

      await within(overviewSection()).findByText('Paused · Every day');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the sheet without acting', async () => {
      const sheet = await openSheet();

      fireEvent.click(
        within(sheet).getByRole('button', { name: dictionary.actions.cancel }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(within(overviewSection()).getByText('Every day')).toBeTruthy();
    });
  });

  it('keeps the activity when a menu action fails', async () => {
    const failure = vi
      .spyOn(db.recurrences, 'put')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await createRecurrence({ scope, content, rule: daily });
    await renderSurface();
    await chooseAction(dictionary.recurring.actionPause);

    await waitFor(() => expect(logged).toHaveBeenCalled());
    expect(within(overviewSection()).getByText('Every day')).toBeTruthy();

    failure.mockRestore();
    logged.mockRestore();
  });

  describe('views', () => {
    it('starts on Execute and switches to Manage', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const execute = screen.getByRole('button', {
        name: dictionary.recurring.viewExecute,
      });
      const manage = screen.getByRole('button', {
        name: dictionary.recurring.viewManage,
      });

      expect(screen.getByRole('region', { name: 'Day view' })).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Activities' })).toBeNull();
      expect(execute.getAttribute('aria-pressed')).toBe('true');
      expect(
        screen.queryByRole('button', {
          name: dictionary.recurring.newActivity,
        }),
      ).toBeNull();

      fireEvent.click(manage);

      expect(screen.getByRole('region', { name: 'Activities' })).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Day view' })).toBeNull();
      expect(manage.getAttribute('aria-pressed')).toBe('true');
      expect(
        screen.getByRole('button', { name: dictionary.recurring.newActivity }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: dictionary.navigation.categories }),
      ).toBeTruthy();
    });

    it('keeps the selected date when switching views', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      fireEvent.click(
        within(daySection()).getByRole('button', { name: 'Previous day' }),
      );
      await within(daySection()).findByText(/November 5, 2026/);

      overviewSection();

      expect(within(daySection()).getByText(/November 5, 2026/)).toBeTruthy();
    });

    it('keeps the view when the date changes', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      fireEvent.click(
        within(daySection()).getByRole('button', { name: 'Next day' }),
      );

      expect(
        screen
          .getByRole('button', { name: dictionary.recurring.viewExecute })
          .getAttribute('aria-pressed'),
      ).toBe('true');
    });
  });

  describe('category tabs', () => {
    async function createInCategory(text: string, name: string | null) {
      const category = name
        ? await createCategoryTag({
            scope,
            surface: 'recurrence',
            name,
            colorHex: '#2563eb',
          })
        : null;

      await createRecurrence({
        scope,
        content: {
          ...content,
          text,
          children: [],
          categoryTagId: category?.id ?? null,
        },
        rule: daily,
      });
    }

    it('filters the day by category with more than one category', async () => {
      await createInCategory('Run', 'Health');
      await createInCategory('Report', 'Work');
      await renderSurface();

      const section = daySection();
      const tabs = await within(section).findByRole('tablist', {
        name: dictionary.calendar.categoryTabs,
      });

      await within(tabs).findByRole('tab', { name: 'WORK' });
      expect(within(section).getByRole('group', { name: 'Run' })).toBeTruthy();
      expect(
        within(section).getByRole('group', { name: 'Report' }),
      ).toBeTruthy();

      fireEvent.click(within(tabs).getByRole('tab', { name: 'WORK' }));

      await waitFor(() =>
        expect(
          within(section).queryByRole('group', { name: 'Run' }),
        ).toBeNull(),
      );
      expect(
        within(section).getByRole('group', { name: 'Report' }),
      ).toBeTruthy();

      fireEvent.click(
        within(tabs).getByRole('tab', {
          name: dictionary.calendar.categoryTabAll,
        }),
      );

      await within(section).findByRole('group', { name: 'Run' });
    });

    it('shows the tabs with one category and items outside it', async () => {
      await createInCategory('Run', 'Health');
      await createInCategory('Loose', null);
      await renderSurface();

      const section = daySection();
      const tabs = await within(section).findByRole('tablist');

      await within(tabs).findByRole('tab', { name: 'HEALTH' });
      fireEvent.click(
        within(tabs).getByRole('tab', {
          name: dictionary.calendar.categoryTabUncategorized,
        }),
      );

      await waitFor(() =>
        expect(
          within(section).queryByRole('group', { name: 'Run' }),
        ).toBeNull(),
      );
      expect(
        within(section).getByRole('group', { name: 'Loose' }),
      ).toBeTruthy();
    });

    it('hides the tabs when every item shares the category', async () => {
      await createInCategory('Run', 'Health');
      await renderSurface();

      const section = daySection();

      await within(section).findByText('HEALTH');
      expect(within(section).queryByRole('tablist')).toBeNull();
    });

    it('hides the tabs without categories', async () => {
      await createInCategory('Loose', null);
      await renderSurface();

      const section = daySection();

      await within(section).findByRole('group', { name: 'Loose' });
      expect(within(section).queryByRole('tablist')).toBeNull();
    });

    it('does not offer view preferences', async () => {
      await createInCategory('Run', 'Health');
      await createInCategory('Report', 'Work');
      await renderSurface();

      await within(daySection()).findByRole('tablist');
      expect(
        screen.queryByRole('button', {
          name: dictionary.dayEditor.configurePreferences,
        }),
      ).toBeNull();
    });
  });

  describe('answer buttons', () => {
    it('shows icons only, keeping accessible names', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const activity = await findActivity();
      const done = within(activity).getByRole('button', {
        name: 'Done: Stretch',
      });

      expect(done.textContent).toBe('');
      expect(done.querySelector('svg')).not.toBeNull();
    });
  });

  describe('category presentation', () => {
    async function createCategorized() {
      const category = await createCategoryTag({
        scope,
        surface: 'recurrence',
        name: 'Health',
        colorHex: '#2563eb',
      });

      await createRecurrence({
        scope,
        content: { ...content, categoryTagId: category.id },
        rule: daily,
      });
    }

    it('keeps the badge outside the name, next to the actions', async () => {
      await createCategorized();
      await renderSurface();

      const activity = await findActivity();
      const chip = await within(activity).findByText('HEALTH');
      const name = within(activity).getByText('Stretch');

      expect(name.contains(chip)).toBe(false);
      expect(name.compareDocumentPosition(chip)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('tints the row of a categorized activity and not its subtasks', async () => {
      await createCategorized();
      await renderSurface();

      const activity = await findActivity();

      await within(activity).findByText('HEALTH');

      const [main, child] = within(activity)
        .getAllByRole('button', { name: /^Done: / })
        .map((button) => button.closest<HTMLElement>('[data-tree-row]'));

      expect(main?.style.backgroundColor).not.toBe('');
      expect(child?.style.backgroundColor).toBe('');
    });

    it('keeps the neutral background without a category', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const activity = await findActivity();
      const row = within(activity)
        .getByRole('button', { name: 'Done: Stretch' })
        .closest<HTMLElement>('[data-tree-row]');

      expect(row?.style.backgroundColor).toBe('');
    });
  });

  describe('editor', () => {
    function openCreate() {
      fireEvent.click(
        within(overviewSection()).getByRole('button', {
          name: new RegExp(
            `^(${dictionary.recurring.newActivity}|${dictionary.recurring.emptyCreate})$`,
          ),
        }),
      );

      return screen.findByRole('dialog');
    }

    async function openEdit() {
      await chooseAction(dictionary.recurring.actionEdit);

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
      await renderSurface();

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
      await renderSurface();

      const dialog = await openCreate();

      expect(
        within(dialog).getByRole('button', {
          name: dictionary.navigation.categories,
        }),
      ).toBeTruthy();
    });

    it('names the subtask action', async () => {
      await createRecurrence({ scope, content, rule: daily });
      await renderSurface();

      const dialog = await openEdit();

      expect(
        within(dialog).getByRole('button', {
          name: dictionary.recurring.addSubtask,
        }),
      ).toBeTruthy();
    });

    it('requires a name', async () => {
      await renderSurface();

      const dialog = await openCreate();
      save(dialog);

      await within(dialog).findByText(dictionary.recurring.nameRequired);
      await expect(db.recurrences.count()).resolves.toBe(0);
    });

    it('creates a weekly activity on the chosen weekdays', async () => {
      await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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
        await renderSurface();

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
        await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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
      await renderSurface();

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
