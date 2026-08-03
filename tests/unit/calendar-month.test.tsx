import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarMonth } from '@/features/calendar';

const scope = {
  id: 'guest:test',
  kind: 'guest' as const,
  ownerId: 'test',
};

const { routerPushMock, routerReplaceMock, useDayEntryMock } = vi.hoisted(
  () => ({
    routerPushMock: vi.fn(),
    routerReplaceMock: vi.fn(),
    useDayEntryMock: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({
  usePathname: () => '/calendar',
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock('@/lib/db', () => ({
  duplicateChecklistItemsToDate: vi.fn().mockResolvedValue(undefined),
  moveChecklistItemsToDate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      calendar: {
        today: 'Today',
        previousYear: 'Previous year',
        nextYear: 'Next year',
        bulkCreate: 'Plan period',
        bulkClear: 'Clear period',
        importCreate: 'Import JSON',
        sortByTime: 'Sort by time',
        weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      dayEditor: {
        title: 'Day editor',
        backToCalendar: 'Back to calendar',
      },
    },
    locale: 'en',
    scope,
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

vi.mock('@/features/categories', () => ({
  useCategoryTags: () => [],
}));

vi.mock('@/features/calendar/use-month-entries', () => ({
  useMonthEntries: () => [],
}));

vi.mock('@/features/calendar/bulk-calendar-editor', () => ({
  BulkCalendarEditor: () => null,
}));

vi.mock('@/features/calendar/calendar-import-dialog', () => ({
  CalendarImportDialog: () => null,
}));

vi.mock('@/features/calendar/calendar-task-transfer-action', () => ({
  CalendarTaskTransferAction: () => <button type="button">Transfer day</button>,
}));

vi.mock('@/features/day-editor/use-day-entry', () => ({
  useDayEntry: useDayEntryMock,
}));

vi.mock('@/features/checklist', () => ({
  ChecklistSurface: ({ dailyEntryId }: { dailyEntryId: string }) => (
    <div data-testid="checklist-surface">{dailyEntryId}</div>
  ),
}));

function getDayCells(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.calendar-day-cell'));
}

describe('CalendarMonth', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/calendar');
    routerPushMock.mockClear();
    routerReplaceMock.mockClear();
    useDayEntryMock.mockReturnValue({ id: 'entry-1' });
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the month grid with 42 day cells when no day is open', () => {
    const { container } = render(<CalendarMonth />);

    expect(getDayCells(container)).toHaveLength(42);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checklist-surface')).not.toBeInTheDocument();
  });

  it('marks today with a hairline ring instead of a fading 1px ring', () => {
    const { container } = render(<CalendarMonth />);

    // today starts selected, so pick another day to expose the today marker
    const otherDay = getDayCells(container).find(
      (cell) => cell.getAttribute('aria-pressed') === 'false',
    ) as HTMLButtonElement;
    fireEvent.click(otherDay);

    const dayNumbers = Array.from(
      container.querySelectorAll('.calendar-day-number'),
    );
    const todayNumbers = dayNumbers.filter((dayNumber) =>
      dayNumber.classList.contains('inset-ring-hairline'),
    );

    expect(todayNumbers).toHaveLength(1);
    expect(todayNumbers[0]).toHaveClass('inset-ring-[#f7e1bc]/35');
    expect(
      dayNumbers.some((dayNumber) => dayNumber.classList.contains('ring-1')),
    ).toBe(false);
  });

  it('selects a day on single click without opening it', () => {
    const { container } = render(<CalendarMonth />);
    const dayCell = getDayCells(container)[10] as HTMLButtonElement;

    fireEvent.click(dayCell);

    expect(dayCell).toHaveAttribute('aria-pressed', 'true');
    expect(routerPushMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('checklist-surface')).not.toBeInTheDocument();
  });

  it('opens the day view on double click', () => {
    const { container } = render(<CalendarMonth />);
    const dayCell = getDayCells(container)[10] as HTMLButtonElement;

    fireEvent.doubleClick(dayCell);

    expect(routerPushMock).toHaveBeenCalledTimes(1);
    expect(String(routerPushMock.mock.calls[0]?.[0])).toMatch(
      /^\/calendar\?day=\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('keeps out-of-month days dimmed but still openable', () => {
    const { container } = render(<CalendarMonth />);
    const outOfMonthCell = getDayCells(container).find((cell) =>
      cell.className.includes('opacity-40'),
    ) as HTMLButtonElement | undefined;

    expect(outOfMonthCell).toBeDefined();

    fireEvent.doubleClick(outOfMonthCell as HTMLButtonElement);

    expect(routerPushMock).toHaveBeenCalledTimes(1);
    expect(String(routerPushMock.mock.calls[0]?.[0])).toMatch(
      /^\/calendar\?day=\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('renders the day detail view instead of the grid when a day is open', () => {
    window.history.replaceState({}, '', '/calendar?day=2026-05-21');

    const { container } = render(<CalendarMonth />);

    expect(getDayCells(container)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('checklist-surface')).toHaveTextContent(
      'entry-1',
    );
    expect(
      screen.queryByRole('button', { name: 'Sort by time' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Transfer day' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Back to calendar' }),
    ).toBeInTheDocument();
  });

  it('navigates back to the calendar from the day detail view', () => {
    window.history.replaceState({}, '', '/calendar?day=2026-05-21');

    render(<CalendarMonth />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to calendar' }));

    expect(routerPushMock).toHaveBeenCalledWith('/calendar');
  });
});
