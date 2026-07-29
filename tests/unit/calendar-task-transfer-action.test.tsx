import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarTaskTransferAction } from '@/features/calendar/calendar-task-transfer-action';

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      actions: {
        cancel: 'Cancel',
      },
      calendar: {
        bulkDatePlaceholder: 'DD-MM-YYYY',
        title: 'Daily Tasks',
        transferDescription:
          'Choose the destination date to move or duplicate all tasks from this day.',
        transferDialogTitle: 'Move or duplicate day tasks',
        transferDuplicate: 'Duplicate tasks',
        transferInvalidDate: 'Enter a valid date in DD-MM-YYYY.',
        transferItem: 'Move or duplicate day',
        transferMove: 'Move tasks',
        transferSameDate: 'Choose a different date for this day.',
        transferTargetDate: 'Destination date',
      },
    },
    locale: 'en',
    timezonePreference: {
      timezone: 'America/Sao_Paulo',
    },
  }),
}));

describe('CalendarTaskTransferAction', () => {
  afterEach(() => {
    cleanup();
  });

  it('validates the destination date before transferring', async () => {
    const onMoveToDate = vi.fn().mockResolvedValue(undefined);
    const onDuplicateToDate = vi.fn().mockResolvedValue(undefined);

    render(
      <CalendarTaskTransferAction
        sourceDate="2026-05-21"
        onDuplicateToDate={onDuplicateToDate}
        onMoveToDate={onMoveToDate}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Move or duplicate day' }),
    );
    const moveButton = screen.getByRole('button', { name: 'Move tasks' });
    const duplicateButton = screen.getByRole('button', {
      name: 'Duplicate tasks',
    });

    expect(moveButton).toHaveClass('h-8', 'rounded-full');
    expect(duplicateButton).toHaveClass('h-8', 'rounded-full');
    expect(moveButton.querySelector('svg')).toBeInTheDocument();
    expect(duplicateButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('sm:h-auto');
    expect(screen.getByRole('dialog').querySelector('.modal-panel')).toBeNull();

    fireEvent.click(moveButton);

    expect(
      await screen.findByText('Enter a valid date in DD-MM-YYYY.'),
    ).toBeInTheDocument();
    expect(onMoveToDate).not.toHaveBeenCalled();
    expect(onDuplicateToDate).not.toHaveBeenCalled();
  });

  it('duplicates or moves the tree to the chosen date', async () => {
    const onMoveToDate = vi.fn().mockResolvedValue(undefined);
    const onDuplicateToDate = vi.fn().mockResolvedValue(undefined);

    render(
      <CalendarTaskTransferAction
        sourceDate="2026-05-21"
        onDuplicateToDate={onDuplicateToDate}
        onMoveToDate={onMoveToDate}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Move or duplicate day' }),
    );
    fireEvent.change(screen.getByLabelText('Destination date'), {
      target: { value: '22052026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate tasks' }));

    await waitFor(() => {
      expect(onDuplicateToDate).toHaveBeenCalledWith('2026-05-22');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Move or duplicate day' }),
    );
    fireEvent.change(screen.getByLabelText('Destination date'), {
      target: { value: '22052026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move tasks' }));

    await waitFor(() => {
      expect(onMoveToDate).toHaveBeenCalledWith('2026-05-22');
    });
  });

  it('keeps focus on the destination input while typing', async () => {
    render(
      <CalendarTaskTransferAction
        sourceDate="2026-05-21"
        onDuplicateToDate={vi.fn().mockResolvedValue(undefined)}
        onMoveToDate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Move or duplicate day' }),
    );

    const input = screen.getByLabelText('Destination date');
    input.focus();
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: '22052026' } });

    expect(input).toHaveFocus();
  });
});
