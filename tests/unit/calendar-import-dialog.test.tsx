import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarImportDialog } from '@/features/calendar/calendar-import-dialog';

const { importCalendarDaysMock } = vi.hoisted(() => ({
  importCalendarDaysMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  importCalendarDays: importCalendarDaysMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      actions: {
        cancel: 'Cancel',
      },
      calendar: {
        importApply: 'Import',
        importCreate: 'Import JSON',
        importDescription: 'Paste a JSON payload.',
        importDialogTitle: 'Import tasks from JSON',
        importEmptyPayload: 'The payload has no tasks to import.',
        importInvalidCategory:
          '{path}: "category" must be an object with "name" and "color".',
        importInvalidChildren: '{path}: "children" must be an array.',
        importInvalidColor: '{path}: invalid color.',
        importInvalidDate: '{path}: invalid date. Use YYYY-MM-DD.',
        importInvalidDay: '{path}: each day must be an object.',
        importInvalidItem: '{path}: each task must be an object.',
        importInvalidItems: '{path}: "items" must be an array.',
        importInvalidJson: 'Invalid JSON: {detail}',
        importInvalidPriority: '{path}: "priority" must be true or false.',
        importInvalidRoot: 'The payload must be an object with a "days" array.',
        importInvalidTime: '{path}: invalid time.',
        importLimitExceeded:
          'The payload exceeds the limit of {days} days or {items} tasks.',
        importPayloadLabel: 'JSON payload',
        importPlaceholder: '{"days":[]}',
        importRequirePayload: 'Paste a JSON payload before importing.',
        importRequireText: '{path}: "text" is required and cannot be empty.',
      },
    },
    scope: { id: 'guest:test', kind: 'guest', ownerId: 'test' },
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

function typePayload(value: string) {
  fireEvent.change(screen.getByLabelText('JSON payload'), {
    target: { value },
  });
}

describe('CalendarImportDialog', () => {
  beforeEach(() => {
    importCalendarDaysMock.mockReset();
    importCalendarDaysMock.mockResolvedValue({
      dates: ['2026-07-26'],
      createdCategoryCount: 1,
      itemCount: 2,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('requires a payload before importing', async () => {
    render(<CalendarImportDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByText('Paste a JSON payload before importing.'),
    ).toBeInTheDocument();
    expect(importCalendarDaysMock).not.toHaveBeenCalled();
  });

  it('shows the validation errors and does not write anything', async () => {
    render(<CalendarImportDialog open onClose={vi.fn()} />);

    typePayload(
      JSON.stringify({
        days: [{ date: '2026-07-26', items: [{ text: '' }] }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByText(
        'days[0].items[0].text: "text" is required and cannot be empty.',
      ),
    ).toBeInTheDocument();
    expect(importCalendarDaysMock).not.toHaveBeenCalled();
  });

  it('reports malformed json', async () => {
    render(<CalendarImportDialog open onClose={vi.fn()} />);

    typePayload('{ days: [');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText(/^Invalid JSON: /)).toBeInTheDocument();
    expect(importCalendarDaysMock).not.toHaveBeenCalled();
  });

  it('imports a valid payload with the parsed days', async () => {
    render(<CalendarImportDialog open onClose={vi.fn()} />);

    typePayload(
      JSON.stringify({
        days: [
          {
            date: '2026-07-26',
            items: [
              {
                text: 'Academia',
                time: '07:30',
                priority: true,
                category: { name: 'Saúde', color: '#16a34a' },
              },
            ],
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(importCalendarDaysMock).toHaveBeenCalledTimes(1);
    });

    const [call] = importCalendarDaysMock.mock.calls;
    expect(call[0].timezone).toBe('America/Sao_Paulo');
    expect(call[0].days).toHaveLength(1);
    expect(call[0].days[0]).toMatchObject({ date: '2026-07-26' });
    expect(call[0].days[0].items[0]).toMatchObject({
      text: 'Academia',
      scheduledTime: '07:30',
      priority: true,
      category: { name: 'Saúde', colorHex: '#16a34a' },
    });
  });

  it('closes the dialog right after a successful import', async () => {
    const onClose = vi.fn();
    render(<CalendarImportDialog open onClose={onClose} />);

    typePayload(
      JSON.stringify({
        days: [{ date: '2026-07-26', items: [{ text: 'Revisar PRs' }] }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText('JSON payload')).toHaveValue('');
  });
});
