import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkCalendarEditor } from '@/features/calendar/bulk-calendar-editor';

const {
  applyChecklistTemplateToDateRangeMock,
  clearChecklistItemsFromDateRangeMock,
} = vi.hoisted(() => ({
  applyChecklistTemplateToDateRangeMock: vi
    .fn()
    .mockResolvedValue(['2026-01-05']),
  clearChecklistItemsFromDateRangeMock: vi
    .fn()
    .mockResolvedValue(['2026-01-05']),
}));

vi.mock('@/lib/db', () => ({
  applyChecklistTemplateToDateRange: applyChecklistTemplateToDateRangeMock,
  clearChecklistItemsFromDateRange: clearChecklistItemsFromDateRangeMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      actions: {
        cancel: 'Cancel',
        delete: 'Delete',
      },
      calendar: {
        bulkApply: 'Create',
        bulkClear: 'Clear in bulk',
        bulkClearApply: 'Clear',
        bulkClearDescription: 'All items on the selected days will be removed.',
        bulkClearEditorTitle: 'Clear in bulk',
        bulkCreate: 'Create in bulk',
        bulkDatePlaceholder: 'DD-MM-YYYY',
        bulkEditorTitle: 'Create in bulk',
        bulkEmptyChecklist: 'Start by adding items for this range',
        bulkEndDate: 'End date',
        bulkInvalidDates: 'Enter valid dates in DD-MM-YYYY.',
        bulkInvalidRange: 'End date must be on or after the start date.',
        bulkNoMatchingDates:
          'No dates in this range match the selected weekdays.',
        bulkRequireItems: 'Add at least one item before creating in bulk.',
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
        addItem: 'Add item',
        addChild: 'Add child',
        addCategory: 'Add category',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        close: 'Close',
        collapseItem: 'Collapse item',
        confirmDeleteItem: 'Are you sure you want to delete this item?',
        deleteItem: 'Delete item',
        emptyChecklist: 'Start this day with a checklist item',
        expandItem: 'Expand item',
        indentItem: 'Indent item',
        dragItem: 'Drag item',
        itemTime: 'Task time',
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
        selectItem: 'Select item',
        deselectItem: 'Deselect item',
        itemsSelected: '{count} selected',
        bulkDeleteItems: 'Delete selected',
        confirmBulkDeleteItems: 'Are you sure you want to delete this item?',
        clearSelection: 'Clear selection',
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
    clearChecklistItemsFromDateRangeMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('validates required dates before submitting', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('Start and end dates are required.'),
    ).toBeInTheDocument();
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
  });

  it('masks dates and submits the drafted checklist to the selected weekdays', async () => {
    const onClose = vi.fn();

    render(<BulkCalendarEditor open onClose={onClose} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding items for this range',
      }),
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

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

  it('ignores whitespace-only draft rows when validating bulk creation', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding items for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '10012026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('Add at least one item before creating in bulk.'),
    ).toBeInTheDocument();
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
  });

  it('shows the row selector in create mode drafts', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding items for this range',
      }),
    );

    expect(screen.getByLabelText('Select item')).toBeInTheDocument();
  });

  it('clears the selected weekdays in clear mode', async () => {
    const onClose = vi.fn();

    render(<BulkCalendarEditor mode="clear" open onClose={onClose} />);

    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '10012026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(clearChecklistItemsFromDateRangeMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        startDate: '2026-01-01',
        endDate: '2026-01-10',
        selectedWeekdays: [1],
      });
    });
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps only the left highlight when a priority draft item has no category', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding items for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'My recurring task' },
    });
    fireEvent.click(screen.getByLabelText('Mark as priority'));

    const input = screen.getByDisplayValue(
      'My recurring task',
    ) as HTMLInputElement;
    const row = input.closest('div[style]') as HTMLDivElement | null;

    expect(row).toHaveStyle({
      boxShadow: 'inset 4px 0 0 0 rgba(240, 195, 142, 1)',
    });
    expect(row?.style.backgroundColor).toBe('');
    expect(input.className.includes('font-medium')).toBe(false);
  });

  it('focuses a sibling draft item after creating it with Enter', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const frameCallbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    }) as typeof window.requestAnimationFrame;

    try {
      render(<BulkCalendarEditor open onClose={vi.fn()} />);

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Start by adding items for this range',
        }),
      );
      fireEvent.change(screen.getByPlaceholderText('Write a task'), {
        target: { value: 'Recurring task' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('Write a task'), {
        key: 'Enter',
      });

      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Write a task')).toHaveLength(2);
      });

      act(() => {
        while (frameCallbacks.length > 0) {
          frameCallbacks.shift()?.(0);
        }
      });

      expect(screen.getAllByPlaceholderText('Write a task')[1]).toHaveFocus();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
