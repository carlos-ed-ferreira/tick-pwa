import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DayDetail } from '@/features/day-editor/day-detail';
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';

const { useDayEntryMock } = vi.hoisted(() => ({
  useDayEntryMock: vi.fn(),
}));

vi.mock('@/features/day-editor/use-day-entry', () => ({
  useDayEntry: useDayEntryMock,
}));

vi.mock('@/features/checklist', () => ({
  ChecklistSurface: () => <div data-testid="checklist-surface" />,
}));

vi.mock('@/features/calendar/calendar-task-transfer-action', () => ({
  CalendarTaskTransferAction: () => (
    <button type="button">{ptBRDictionary.calendar.transferItem}</button>
  ),
}));

vi.mock('@/features/categories/category-manager', () => ({
  CategoryManagerDialog: ({
    open,
    surface,
    title,
  }: {
    open: boolean;
    surface: string;
    title: string;
  }) =>
    open ? (
      <div aria-label={title} data-surface={surface} role="dialog" />
    ) : null,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: ptBRDictionary,
    locale: 'pt-BR',
    scope: { id: 'guest:test', kind: 'guest', ownerId: 'test' },
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

describe('DayDetail categories action', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useDayEntryMock.mockReturnValue({ id: 'entry-1' });
  });

  it('opens the task category manager next to the transfer action', () => {
    render(<DayDetail date="2026-05-21" showBackAction={false} />);

    const transferButton = screen.getByRole('button', {
      name: ptBRDictionary.calendar.transferItem,
    });
    const categoriesButton = screen.getByRole('button', {
      name: ptBRDictionary.navigation.categories,
    });

    expect(categoriesButton.parentElement).toBe(transferButton.parentElement);

    fireEvent.click(categoriesButton);

    expect(
      screen.getByRole('dialog', {
        name: ptBRDictionary.calendar.editCategories,
      }),
    ).toHaveAttribute('data-surface', 'checklist_item');
  });

  it('hides the day actions while the day entry is not available', () => {
    useDayEntryMock.mockReturnValue(null);

    render(<DayDetail date="2026-05-21" showBackAction={false} />);

    expect(
      screen.queryByRole('button', {
        name: ptBRDictionary.navigation.categories,
      }),
    ).not.toBeInTheDocument();
  });
});
