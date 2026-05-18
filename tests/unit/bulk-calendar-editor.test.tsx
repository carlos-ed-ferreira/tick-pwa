import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkCalendarEditor } from '@/features/calendar/bulk-calendar-editor';

const { applyChecklistTemplateToDateRangeMock } = vi.hoisted(() => ({
  applyChecklistTemplateToDateRangeMock: vi
    .fn()
    .mockResolvedValue(['2026-01-05']),
}));

vi.mock('@/lib/db', () => ({
  applyChecklistTemplateToDateRange: applyChecklistTemplateToDateRangeMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      actions: {
        cancel: 'Cancel',
        delete: 'Delete',
      },
      calendar: {
        bulkApply: 'Apply to dates',
        bulkCreate: 'Apply range',
        bulkDatePlaceholder: 'DD-MM-YYYY',
        bulkEditorTitle: 'Apply checklist to date range',
        bulkEndDate: 'End date',
        bulkInvalidDates: 'Enter valid dates in DD-MM-YYYY.',
        bulkInvalidRange: 'End date must be on or after the start date.',
        bulkNoMatchingDates:
          'No dates in this range match the selected weekdays.',
        bulkRequireItems: 'Add at least one item before applying the range.',
        bulkRequiredDates: 'Start and end dates are required.',
        bulkSelectWeekdays: 'Select at least one weekday.',
        bulkStartDate: 'Start date',
        bulkWeekdays: 'Weekdays',
        today: 'Today',
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        previousYear: 'Previous year',
        nextYear: 'Next year',
        emptyDay: 'No items',
        weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      dayEditor: {
        checklist: 'Checklist',
        addItem: 'Add item',
        addChild: 'Add child',
        addCategory: 'Add category',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        close: 'Close',
        collapseItem: 'Collapse item',
        confirmDeleteItem: 'This item has content. Delete it anyway?',
        deleteItem: 'Delete item',
        emptyChecklist: 'Start this day with a checklist item',
        expandItem: 'Expand item',
        indentItem: 'Indent item',
        itemPlaceholder: 'Write a task',
        markPriority: 'Mark as priority',
        moveCategoryDown: 'Move category down',
        moveCategoryUp: 'Move category up',
        moveItemDown: 'Move item down',
        moveItemUp: 'Move item up',
        newCategory: 'New category',
        outdentItem: 'Outdent item',
        title: 'Day editor',
        toggleItem: 'Toggle item',
        unmarkPriority: 'Remove priority',
        untitledItem: 'New item',
        categories: 'Categories',
        categoryNamePlaceholder: 'Category name',
        deleteCategory: 'Delete category',
      },
    },
    scope: {
      id: 'guest:test',
      kind: 'guest',
      ownerId: 'test',
    },
    timezonePreference: {
      timezone: 'America/Sao_Paulo',
    },
  }),
}));

vi.mock('@/features/categories', () => ({
  CategoryAssignmentMenu: () => null,
  useCategoryTags: () => [],
}));

describe('BulkCalendarEditor', () => {
  beforeEach(() => {
    applyChecklistTemplateToDateRangeMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('validates required dates before submitting', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply to dates' }));

    expect(
      await screen.findByText('Start and end dates are required.'),
    ).toBeInTheDocument();
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
  });

  it('masks dates and submits the drafted checklist to the selected weekdays', async () => {
    const onClose = vi.fn();

    render(<BulkCalendarEditor open onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'My recurring task' },
    });
    fireEvent.click(screen.getByLabelText('Mark as priority'));
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '10012026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));

    expect(screen.getByLabelText('Start date')).toHaveValue('01-01-2026');
    expect(screen.getByLabelText('End date')).toHaveValue('10-01-2026');

    fireEvent.click(screen.getByRole('button', { name: 'Apply to dates' }));

    await waitFor(() => {
      expect(applyChecklistTemplateToDateRangeMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        startDate: '2026-01-01',
        endDate: '2026-01-10',
        selectedWeekdays: [1],
        templateItems: [
          expect.objectContaining({
            text: 'My recurring task',
            parentId: null,
            priority: true,
          }),
        ],
        timezone: 'America/Sao_Paulo',
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps only the left highlight when a priority draft item has no category', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'My recurring task' },
    });
    fireEvent.click(screen.getByLabelText('Mark as priority'));

    const input = screen.getByDisplayValue('My recurring task');
    const row = input.closest('div[style]');

    expect(row).toHaveStyle({
      boxShadow: 'inset 3px 0 0 0 rgba(245, 158, 11, 0.9)',
    });
    expect(row?.style.backgroundColor).toBe('');
    expect(input.className.includes('font-medium')).toBe(false);
  });
});
