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
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  applyChecklistTemplateToDateRangeMock: vi
    .fn()
    .mockResolvedValue(['2026-01-05']),
  clearChecklistItemsFromDateRangeMock: vi
    .fn()
    .mockResolvedValue(['2026-01-05']),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  applyChecklistTemplateToDateRange: applyChecklistTemplateToDateRangeMock,
  clearChecklistItemsFromDateRange: clearChecklistItemsFromDateRangeMock,
}));

vi.mock('@/components/ui/toast', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
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
        bulkApplyAndClose: 'Create and close',
        bulkAllWeekdaysHint: 'Rule: no selection means every day.',
        bulkClear: 'Clear in bulk',
        bulkClearApply: 'Clear',
        bulkClearDescription: 'All tasks on the selected days will be removed.',
        bulkClearTasks: 'Clear tasks',
        bulkCreated: 'Tasks created.',
        bulkClearEditorTitle: 'Clear in bulk',
        bulkCreate: 'Create in bulk',
        bulkDatePlaceholder: 'DD-MM-YYYY',
        bulkEditorTitle: 'Create in bulk',
        bulkEmptyChecklist: 'Start by adding tasks for this range',
        bulkEndDate: 'End date',
        bulkInvalidDates: 'Enter valid dates in DD-MM-YYYY.',
        bulkInvalidRange: 'End date must be on or after the start date.',
        bulkNoMatchingDates:
          'No dates in this range match the selected weekdays.',
        bulkRequireItems: 'Add at least one task before creating in bulk.',
        bulkRequiredDates: 'Start and end dates are required.',
        bulkStartDate: 'Start date',
        bulkWeekdays: 'Weekdays',
        sortByTime: 'Sort by time',
        today: 'Today',
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        openDatePicker: 'Open date picker for {label}',
        previousYear: 'Previous year',
        selectDate: 'Select date',
        nextYear: 'Next year',
        emptyDay: 'No tasks',
        weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      dayEditor: {
        addItem: 'Add task',
        addChild: 'Create subtask',
        addCategory: 'Add category',
        assignCategory: 'Assign category',
        clearCategory: 'Clear category',
        close: 'Close',
        collapseItem: 'Collapse task',
        confirmDeleteItem: 'Are you sure you want to delete this task?',
        deleteItem: 'Delete task',
        emptyChecklist: 'Start this day with a task',
        expandItem: 'Expand task',
        indentItem: 'Make subtask',
        dragItem: 'Drag task',
        itemTime: 'Task time',
        itemPlaceholder: 'Write a task',
        makeTextBold: 'Make text bold',
        makeTextNormal: 'Make text normal',
        markPriority: 'Mark as priority',
        moveCategoryDown: 'Move category down',
        moveCategoryUp: 'Move category up',
        moveItemDown: 'Move task down',
        moveItemUp: 'Move task up',
        moreActions: 'More actions',
        newCategory: 'New category',
        outdentItem: 'Promote task one level',
        title: 'Day editor',
        toggleItem: 'Change task status',
        selectItem: 'Select task',
        deselectItem: 'Deselect task',
        itemSelected: '{count} task selected',
        itemsSelected: '{count} tasks selected',
        bulkDeleteItems: 'Delete selected tasks',
        confirmBulkDeleteItem:
          'You are about to delete {count} selected record.',
        confirmBulkDeleteItems: 'Are you sure you want to delete this task?',
        clearSelection: 'Clear selection',
        bulkPriority: 'Priority',
        bulkBold: 'Bold',
        bulkCategory: 'Category',
        bulkDelete: 'Delete',
        bulkMark: 'Mark',
        actionHidden: 'Hidden',
        actionInMenu: 'Three-dot menu',
        actionOnRow: 'On row',
        actionVisible: 'Visible',
        configurePreferences: 'Configure task actions',
        dragAndDrop: 'Drag and drop',
        preferencesTitle: 'Task actions',
        resetPreferences: 'Restore defaults',
        unmarkPriority: 'Remove priority',
        untitledItem: 'New task',
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
    toastErrorMock.mockClear();
    toastSuccessMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('validates required dates before submitting', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    const createButton = screen.getByRole('button', { name: 'Create' });

    expect(dialog.querySelector('.modal-panel')).toBeNull();
    expect(createButton).toHaveClass('h-8', 'rounded-full');
    expect(createButton.querySelector('svg')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Open date picker for Start date',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Open date picker for End date',
      }),
    ).toBeInTheDocument();

    fireEvent.click(createButton);

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Start and end dates are required.',
    );
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
  });

  it('creates without closing and preserves the editor state', async () => {
    const onClose = vi.fn();

    render(<BulkCalendarEditor open onClose={onClose} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'My recurring task' },
    });
    fireEvent.click(screen.getByLabelText('More actions'));
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
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('Tasks created.');
    expect(screen.getByLabelText('Start date')).toHaveValue('01-01-2026');
    expect(screen.getByLabelText('End date')).toHaveValue('10-01-2026');
    expect(screen.getByPlaceholderText('Write a task')).toHaveValue(
      'My recurring task',
    );
  });

  it('creates and closes when explicitly requested', async () => {
    const onClose = vi.fn();

    render(<BulkCalendarEditor open onClose={onClose} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'Close after creating' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '02012026' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create and close' }));

    await waitFor(() => {
      expect(applyChecklistTemplateToDateRangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedWeekdays: [],
          templateItems: [
            expect.objectContaining({ text: 'Close after creating' }),
          ],
        }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses every day when no weekday is selected', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'Every day' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '03012026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(applyChecklistTemplateToDateRangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedWeekdays: [],
        }),
      );
    });
    expect(screen.getByRole('note')).toHaveTextContent(
      'Rule: no selection means every day.',
    );
    expect(screen.getByRole('note').querySelector('svg')).toBeInTheDocument();
  });

  it('clears only the drafted tasks', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'Temporary task' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '10012026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear tasks' }));

    expect(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('01-01-2026');
    expect(screen.getByLabelText('End date')).toHaveValue('10-01-2026');
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('ignores whitespace-only draft rows when validating bulk creation', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
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

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Add at least one task before creating in bulk.',
    );
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
  });

  it('shows the row selector in create mode drafts', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );

    expect(screen.getByLabelText('Select task')).toBeInTheDocument();
  });

  it('shows the shared selection footer for draft rows', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.click(screen.getByLabelText('Select task'));

    expect(
      screen.getByRole('button', { name: '1 task selected' }),
    ).toBeInTheDocument();
  });

  it('completes the selected draft rows from the collective action', async () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.click(screen.getByLabelText('Select task'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark · 1 task selected' }),
    );

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { checked: true })).toBeVisible();
    });
  });

  it('clears every weekday in clear mode when none are selected', async () => {
    const onClose = vi.fn();

    render(<BulkCalendarEditor mode="clear" open onClose={onClose} />);

    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '01012026' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '10012026' },
    });
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
        selectedWeekdays: [],
      });
    });
    expect(applyChecklistTemplateToDateRangeMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps only the left highlight when a priority draft item has no category', () => {
    render(<BulkCalendarEditor open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start by adding tasks for this range',
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Write a task'), {
      target: { value: 'My recurring task' },
    });
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByLabelText('Mark as priority'));

    const input = screen.getByDisplayValue(
      'My recurring task',
    ) as HTMLInputElement;
    const row = input.closest('div[style]') as HTMLDivElement | null;

    expect(row).toHaveStyle({
      boxShadow:
        'inset 4px 0 0 0 rgba(240, 195, 142, 1), inset 0 0 18px rgba(240, 195, 142, 0.12)',
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
          name: 'Start by adding tasks for this range',
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
