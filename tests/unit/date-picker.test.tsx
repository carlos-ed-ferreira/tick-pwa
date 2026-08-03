import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@/components/app';

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      calendar: {
        nextMonth: 'Next month',
        openDatePicker: 'Open date picker for {label}',
        previousMonth: 'Previous month',
        selectDate: 'Select date',
        today: 'Today',
        weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
    },
    locale: 'en',
    timezonePreference: {
      timezone: 'America/Sao_Paulo',
    },
  }),
}));

describe('DatePicker', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps manual date entry masked', () => {
    const onChange = vi.fn();

    render(
      <DatePicker
        label="Start date"
        placeholder="DD-MM-YYYY"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '15072026' },
    });

    expect(onChange).toHaveBeenCalledWith('15-07-2026');
  });

  it('opens the shared calendar and selects a date', () => {
    const onChange = vi.fn();

    render(
      <DatePicker
        label="Start date"
        placeholder="DD-MM-YYYY"
        value="15-07-2026"
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open date picker for Start date',
      }),
    );

    const calendar = screen.getByRole('dialog', { name: 'Select date' });
    const selectedDate = screen.getByRole('button', {
      name: 'July 15, 2026',
    });

    expect(calendar).toHaveClass('tick-datepicker');
    expect(screen.getByText('July 2026')).toBeInTheDocument();
    expect(selectedDate).toHaveAttribute('aria-pressed', 'true');
    expect(selectedDate).toHaveClass('bg-[#f0c38e]', 'text-[#253241]');

    fireEvent.click(screen.getByRole('button', { name: 'July 20, 2026' }));

    expect(onChange).toHaveBeenCalledWith('20-07-2026');
    expect(
      screen.queryByRole('dialog', { name: 'Select date' }),
    ).not.toBeInTheDocument();
  });

  it('marks today with a hairline ring instead of a fading 1px ring', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        label="Start date"
        placeholder="DD-MM-YYYY"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open date picker for Start date',
      }),
    );

    const calendar = screen.getByRole('dialog', { name: 'Select date' });
    const today = calendar.querySelector('button.inset-ring-hairline');

    expect(today).toBeInTheDocument();
    expect(today).toHaveClass('inset-ring-[#f0c38e]/35', 'rounded-full');
    expect(calendar.querySelector('.ring-1')).not.toBeInTheDocument();
  });

  it('navigates between months without changing the value', () => {
    const onChange = vi.fn();

    render(
      <DatePicker
        label="End date"
        placeholder="DD-MM-YYYY"
        value="15-07-2026"
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open date picker for End date',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
