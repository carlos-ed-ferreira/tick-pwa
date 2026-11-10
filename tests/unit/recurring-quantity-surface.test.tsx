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
  createRecurrence,
  db,
  setRecurrenceQuantity,
  setRecurrenceResponse,
} from '@/lib/db';
import { RecurringSurface } from '@/features/recurring';
import { getDictionary } from '@/lib/i18n/dictionaries';

const today = '2026-11-06' as const;
const scope = createGuestScope('recurring-quantity-surface');
const dictionary = getDictionary('en');
const labels = dictionary.recurring;

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary,
    locale: 'en',
    scope,
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

vi.mock('@/lib/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/time')>()),
  getTodayKey: () => '2026-11-06',
}));

const daily: RecurrenceRule = {
  kind: 'interval',
  everyDays: 1,
  anchorDate: '2026-01-01',
};
const pages = { target: 20, unit: 'pages' };
const reading: RecurrenceContent = {
  text: 'Read',
  bold: false,
  priority: false,
  categoryTagId: null,
  children: [],
  measure: pages,
};

function region(name: string) {
  return screen.getByRole('region', { name });
}

function showView(name: string, tab: string) {
  const current = screen.queryByRole('region', { name });

  if (current) {
    return current;
  }

  fireEvent.click(screen.getByRole('button', { name: tab }));

  return region(name);
}

const daySection = () => showView('Day view', labels.viewExecute);
const activitiesSection = () => showView('Activities', labels.viewActivities);
const performanceSection = () =>
  showView('Performance', labels.viewPerformance);

async function renderSurface() {
  render(<RecurringSurface />);
  await screen.findByRole('region', { name: /^(Activities|Day view)$/ });
}

async function createReading(overrides: Partial<RecurrenceContent> = {}) {
  const recurrence = await createRecurrence({
    scope,
    content: { ...reading, ...overrides },
    rule: daily,
  });

  await db.recurrences.update(recurrence.id, {
    createdAt: '2026-11-01T15:00:00.000Z',
  });

  return recurrence;
}

async function openQuantity(name = 'Read') {
  fireEvent.click(
    await within(daySection()).findByRole('button', {
      name: new RegExp(`^${labels.recordQuantity}:`),
    }),
  );

  return screen.findByRole('dialog', { name });
}

async function openCreate() {
  fireEvent.click(
    within(activitiesSection()).getByRole('button', {
      name: new RegExp(`^(${labels.newActivity}|${labels.emptyCreate})$`),
    }),
  );

  return screen.findByRole('dialog');
}

async function openEdit(name: string) {
  fireEvent.click(
    await within(activitiesSection()).findByRole('button', {
      name: `More actions: ${name}`,
    }),
  );
  fireEvent.click(
    await screen.findByRole('menuitem', { name: labels.actionEdit }),
  );

  return screen.findByRole('dialog');
}

function fill(scopeElement: HTMLElement, label: string, value: string) {
  fireEvent.change(within(scopeElement).getByLabelText(label), {
    target: { value },
  });
}

function save(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: labels.save }));
}

describe('quantitative recurring activities', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/recurring');
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    cleanup();
    await db.delete();
  });

  describe('editor', () => {
    it('creates an activity with a decimal target', async () => {
      await renderSurface();

      const dialog = await openCreate();

      fill(dialog, labels.nameLabel, 'Walk');
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.measureToggle }),
      );
      fill(dialog, labels.measureTargetLabel, '5,5');
      fill(dialog, labels.measureUnitLabel, ' km ');
      save(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await expect(db.recurrences.toArray()).resolves.toMatchObject([
        { measure: { target: 5.5, unit: 'km' } },
      ]);
    });

    it('explains an invalid target and keeps the editor open', async () => {
      await renderSurface();

      const dialog = await openCreate();

      fill(dialog, labels.nameLabel, 'Walk');
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.measureToggle }),
      );
      fill(dialog, labels.measureTargetLabel, '0');
      fill(dialog, labels.measureUnitLabel, 'km');
      save(dialog);

      expect(
        await within(dialog).findByText(labels.measureTargetInvalid),
      ).toBeTruthy();
      await expect(db.recurrences.count()).resolves.toBe(0);
    });

    it('measures the subtasks instead of a grouping activity', async () => {
      await createReading({
        measure: null,
        children: [
          {
            id: 'stretch',
            parentId: null,
            text: 'Stretch',
            bold: false,
            priority: false,
            sortRank: 'a0',
          },
        ],
      });
      await renderSurface();

      const dialog = await openEdit('Read');
      const [rootToggle] = within(dialog).getAllByRole('button', {
        name: labels.measureToggle,
      });

      expect((rootToggle as HTMLButtonElement).disabled).toBe(true);
      expect(within(dialog).getByText(labels.measureWithChildren)).toBeTruthy();

      const subtasks = within(dialog).getByRole('region', {
        name: labels.childMeasuresTitle,
      });

      fireEvent.click(
        within(subtasks).getByRole('button', { name: labels.measureToggle }),
      );
      fill(subtasks, labels.measureTargetLabel, '10');
      fill(subtasks, labels.measureUnitLabel, 'min');
      save(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await expect(db.recurrences.toArray()).resolves.toMatchObject([
        { children: [{ id: 'stretch', measure: { target: 10, unit: 'min' } }] },
      ]);
    });

    it('warns that a new measure applies from tomorrow', async () => {
      const { id } = await createReading({ measure: null });

      await setRecurrenceResponse({
        date: today,
        itemId: null,
        recurrenceId: id,
        scope,
        status: 'done',
        today,
      });
      await renderSurface();

      const dialog = await openEdit('Read');

      expect(within(dialog).queryByText(labels.measureForwardNote)).toBeNull();
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.measureToggle }),
      );

      expect(within(dialog).getByText(labels.measureForwardNote)).toBeTruthy();
    });
  });

  it('shows the target next to the frequency of the activity', async () => {
    await createReading();
    await renderSurface();

    expect(
      await within(activitiesSection()).findByText(
        'Every day · Target: 20 pages',
      ),
    ).toBeTruthy();
  });

  describe('execute', () => {
    it('records, completes, zeroes and clears the amount of the day', async () => {
      await createReading();
      await renderSurface();

      const day = daySection();

      expect(await within(day).findByText('— / 20 pages')).toBeTruthy();
      expect(
        within(day).queryByRole('button', { name: /^Done: Read$/ }),
      ).toBeNull();

      let dialog = await openQuantity();

      fill(dialog, labels.quantityFieldLabel, '10');
      save(dialog);

      expect(await within(day).findByText('10 / 20 pages')).toBeTruthy();
      expect(within(day).getByText('50%')).toBeTruthy();
      expect(
        within(day)
          .getByRole('progressbar', { name: 'Progress: Read' })
          .getAttribute('aria-valuenow'),
      ).toBe('50');

      dialog = await openQuantity();
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.quantityComplete }),
      );
      expect(await within(day).findByText('20 / 20 pages')).toBeTruthy();

      dialog = await openQuantity();
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.quantityZero }),
      );
      expect(await within(day).findByText('0 / 20 pages')).toBeTruthy();

      dialog = await openQuantity();
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.quantityClear }),
      );
      expect(await within(day).findByText('— / 20 pages')).toBeTruthy();
    });

    it('keeps a larger amount when completing and shows the excess', async () => {
      const { id } = await createReading();

      await setRecurrenceQuantity({
        date: today,
        itemId: null,
        recurrenceId: id,
        scope,
        today,
        value: 25,
      });
      await renderSurface();

      const dialog = await openQuantity();

      expect(
        within(dialog).getByText('+5 pages above the target'),
      ).toBeTruthy();
      fireEvent.click(
        within(dialog).getByRole('button', { name: labels.quantityComplete }),
      );

      expect(
        await within(daySection()).findByText('25 / 20 pages'),
      ).toBeTruthy();
    });

    it('rejects an invalid amount', async () => {
      await createReading();
      await renderSurface();

      const dialog = await openQuantity();

      fill(dialog, labels.quantityFieldLabel, '-3');
      save(dialog);

      expect(within(dialog).getByText(labels.quantityInvalid)).toBeTruthy();
      await expect(db.recurrenceResponses.count()).resolves.toBe(0);
    });

    it('records a measured subtask on its own row', async () => {
      const { id } = await createReading({
        measure: null,
        children: [
          {
            id: 'stretch',
            parentId: null,
            text: 'Stretch',
            bold: false,
            priority: false,
            sortRank: 'a0',
            measure: { target: 10, unit: 'min' },
          },
        ],
      });
      await renderSurface();

      expect(
        await within(daySection()).findByRole('button', { name: 'Done: Read' }),
      ).toBeTruthy();

      const dialog = await openQuantity('Stretch');

      fill(dialog, labels.quantityFieldLabel, '7');
      save(dialog);

      await waitFor(async () =>
        expect(
          await db.recurrenceResponses.get(
            `rr:${scope.id}:${id}:${today}:stretch`,
          ),
        ).toMatchObject({ quantity: { target: 10, unit: 'min', value: 7 } }),
      );
    });
  });

  describe('performance', () => {
    async function createHistory() {
      const { id } = await createReading();

      for (const [date, value] of [
        ['2026-11-01', 10],
        ['2026-11-02', 20],
        ['2026-11-03', 30],
        ['2026-11-04', 0],
      ] as const) {
        await setRecurrenceQuantity({
          date,
          itemId: null,
          recurrenceId: id,
          scope,
          today,
          value,
        });
      }

      return id;
    }

    it('shows partial results and the amount progress per activity', async () => {
      await createHistory();
      await renderSurface();

      const performance = performanceSection();

      expect(
        await within(performance).findByText('2 done, 1 partial, 1 at zero'),
      ).toBeTruthy();
      expect(
        within(performance).getByText(labels.quantityProgressTitle),
      ).toBeTruthy();
      expect(within(performance).getByText(labels.partialTitle)).toBeTruthy();
    });

    it('details amounts, partial days and the capped progress', async () => {
      const id = await createHistory();

      window.history.replaceState(
        null,
        '',
        `/recurring?view=performance&activity=${id}`,
      );
      render(<RecurringSurface />);

      const detail = await screen.findByRole('region', { name: 'Performance' });

      expect(await within(detail).findByText('Done: 60 pages')).toBeTruthy();
      expect(
        within(detail).getByText('2 of 4 recorded runs completed'),
      ).toBeTruthy();
      expect(
        within(detail).getByText('4 of 5 occurrences recorded'),
      ).toBeTruthy();
      expect(
        within(detail).getByText('50 of 80 pages expected in the records'),
      ).toBeTruthy();
      expect(within(detail).getByText('10 / 20 pages · 50%')).toBeTruthy();
      expect(within(detail).getByText('30 / 20 pages · 100%')).toBeTruthy();
      expect(
        within(detail).getByRole('button', {
          name: 'Sunday, November 1, 2026: Partial · 10 / 20 pages · 50%',
        }),
      ).toBeTruthy();
    });
  });
});
