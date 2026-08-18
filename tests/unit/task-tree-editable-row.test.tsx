import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultTaskTreeRowActionPreferences,
  TaskTreeEditableRow,
} from '@/components/app';

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      calendar: {
        clearDate: 'Clear date',
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

vi.mock('@/features/categories', () => ({
  CategoryAssignmentMenu: ({
    assignLabel,
    clearLabel,
    renderTriggerContent,
    selectedCategoryTagId,
    showClearButton = true,
    triggerClassName,
    onAssign,
  }: {
    assignLabel: string;
    clearLabel: string;
    renderTriggerContent?: () => ReactNode;
    selectedCategoryTagId: string | null;
    showClearButton?: boolean;
    triggerClassName?: string;
    onAssign: (categoryTagId: string | null) => void;
  }) => (
    <div>
      <button
        type="button"
        aria-label={assignLabel}
        className={triggerClassName}
        onClick={() => onAssign('category-1')}
      >
        {renderTriggerContent ? renderTriggerContent() : assignLabel}
      </button>
      {selectedCategoryTagId && showClearButton ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onAssign(null)}
        />
      ) : null}
    </div>
  ),
}));

const labels = {
  addChild: 'Add child',
  assignCategory: 'Assign category',
  bulkBold: 'Bold',
  bulkCategory: 'Category',
  bulkDelete: 'Delete',
  bulkPriority: 'Priority',
  cancel: 'Cancel',
  clearCategory: 'Clear category',
  collapseItem: 'Collapse item',
  confirmDeleteItem: 'Confirm delete',
  delete: 'Delete',
  deleteItem: 'Delete item',
  deselectItem: 'Deselect item',
  expandItem: 'Expand item',
  indentItem: 'Indent item',
  itemPlaceholder: 'Write a task',
  markPriority: 'Mark as priority',
  moveItemDown: 'Move item down',
  moveItemUp: 'Move item up',
  moreActions: 'More actions',
  dragItem: 'Drag item',
  itemTime: 'Task time',
  itemDate: 'Task date',
  makeTextBold: 'Make text bold',
  makeTextNormal: 'Make text normal',
  outdentItem: 'Outdent item',
  selectItem: 'Select item',
  toggleItem: 'Toggle item',
  unmarkPriority: 'Remove priority',
};

function renderRow(
  overrides: Partial<Parameters<typeof TaskTreeEditableRow>[0]> = {},
) {
  const callbacks = {
    onAssignCategory: vi.fn(),
    onCreateChild: vi.fn().mockResolvedValue('new-item'),
    onCreateSibling: vi.fn().mockResolvedValue('new-item'),
    onDelete: vi.fn(),
    onIndent: vi.fn(),
    onMoveDown: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveTo: vi.fn(),
    onOutdent: vi.fn(),
    onSaveText: vi.fn(),
    onToggleChecked: vi.fn().mockResolvedValue(undefined),
    onToggleBold: vi.fn().mockResolvedValue(undefined),
    onToggleCollapsed: vi.fn(),
    onTogglePriority: vi.fn().mockResolvedValue(undefined),
    onSaveTime: vi.fn(),
    onSaveDate: vi.fn(),
  };

  const element = (
    props: Partial<Parameters<typeof TaskTreeEditableRow>[0]> = {},
  ) => (
    <TaskTreeEditableRow
      categoryTagId={null}
      categoryTagMap={new Map()}
      checked={false}
      bold={false}
      collapsed={false}
      depth={0}
      hasChildren={false}
      inputDataAttribute="data-checklist-input"
      inputSelector='[data-checklist-input="true"]'
      isFirstSibling={false}
      isLastSibling={false}
      itemId="item-1"
      labels={labels}
      parentId={null}
      priority={false}
      siblingIds={['item-1']}
      surface="calendar"
      text="Existing item"
      {...callbacks}
      {...overrides}
      {...props}
    />
  );
  const { rerender } = render(element());

  return {
    ...callbacks,
    rerender: (props: Partial<Parameters<typeof TaskTreeEditableRow>[0]>) =>
      rerender(element(props)),
  };
}

describe('TaskTreeEditableRow', () => {
  afterEach(() => {
    cleanup();
  });

  it('applies the shared checkbox and priority behavior immediately', async () => {
    const callbacks = renderRow();
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(callbacks.onToggleChecked).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByLabelText('Mark as priority'));
    expect(callbacks.onTogglePriority).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Remove priority')).toBeInTheDocument();
  });

  it('drops a stale optimistic completion once the item moves past it', async () => {
    const { onToggleChecked, rerender } = renderRow();

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(onToggleChecked).toHaveBeenCalledOnce();
    });
    expect(screen.getByRole('checkbox')).toBeChecked();

    rerender({ checked: true });

    expect(screen.getByRole('checkbox')).toBeChecked();

    rerender({ checked: false, ignored: true });

    expect(screen.getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'mixed',
    );

    rerender({ checked: false, ignored: false });

    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('drops a stale optimistic priority once the item moves past it', async () => {
    const { onTogglePriority, rerender } = renderRow();

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByLabelText('Mark as priority'));

    await waitFor(() => {
      expect(onTogglePriority).toHaveBeenCalledOnce();
    });

    rerender({ priority: true });
    rerender({ priority: false });

    fireEvent.click(screen.getByLabelText('More actions'));

    expect(screen.getByLabelText('Mark as priority')).toBeInTheDocument();
  });

  it('renders ignored tasks with the same faded text and a mixed checkbox', () => {
    renderRow({ checked: false, ignored: true });

    expect(screen.getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
    expect(screen.getByDisplayValue('Existing item')).toHaveClass(
      'text-[#7b8da0]',
      'opacity-75',
    );
  });

  it('toggles the whole task text between normal and bold', () => {
    const callbacks = renderRow();
    const text = screen.getByDisplayValue('Existing item');

    expect(text).not.toHaveClass('font-bold');
    fireEvent.click(screen.getByLabelText('More actions'));
    expect(screen.getByTestId('task-bold-indicator')).toHaveClass(
      'font-normal',
    );
    fireEvent.click(screen.getByLabelText('Make text bold'));

    expect(callbacks.onToggleBold).toHaveBeenCalledOnce();
    expect(text).toHaveClass('font-bold');
    expect(screen.getByTestId('task-bold-indicator')).toHaveClass('font-bold');
    expect(screen.getByLabelText('Make text normal')).toBeInTheDocument();
  });

  it('flushes text before creating a sibling with Enter', async () => {
    const callbacks = renderRow();
    const input = screen.getByDisplayValue('Existing item');

    fireEvent.change(input, { target: { value: 'Edited item' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(callbacks.onSaveText).toHaveBeenCalledWith('Edited item');
      expect(callbacks.onCreateSibling).toHaveBeenCalledOnce();
    });
  });

  it('keeps the single-line text aligned with the time input', () => {
    renderRow({ showScheduledTime: true });
    const textInput = screen.getByDisplayValue('Existing item');

    expect(textInput).toHaveClass('py-0', 'leading-5');
    expect(textInput.closest('[data-task-text-field]')).toHaveClass(
      'min-h-9',
      'items-center',
    );
    expect(screen.getByRole('checkbox').closest('[data-tree-row]')).toHaveClass(
      'min-h-11',
      'rounded-lg',
    );
    expect(screen.getByRole('button', { name: 'Collapse item' })).toHaveClass(
      'ml-1',
      '-mr-2',
    );
    expect(screen.getByRole('button', { name: 'Drag item' })).toHaveClass(
      'cursor-grab',
      'active:cursor-grabbing',
    );
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveClass(
      'mr-1',
    );
  });

  it('uses the same hover classes for add and more actions', () => {
    renderRow();

    const addButton = screen.getByRole('button', { name: 'Add child' });
    const moreButton = screen.getByRole('button', { name: 'More actions' });
    const moreClassesWithoutMargin = moreButton.className
      .split(' ')
      .filter((className) => className !== 'mr-1')
      .join(' ');

    expect(moreClassesWithoutMargin).toBe(addButton.className);
  });

  it('keeps Shift+Enter available for inserting a line break', () => {
    const callbacks = renderRow();
    const input = screen.getByDisplayValue('Existing item');
    const preventDefault = vi.fn();

    fireEvent.keyDown(input, {
      key: 'Enter',
      preventDefault,
      shiftKey: true,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(callbacks.onCreateSibling).not.toHaveBeenCalled();
  });

  it('renders the item text as a one-row textarea that grows with its content', () => {
    renderRow();
    const textarea = screen.getByDisplayValue(
      'Existing item',
    ) as HTMLTextAreaElement;

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.rows).toBe(1);

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      value: 72,
    });

    fireEvent.change(textarea, {
      target: { value: 'A task whose text wraps onto multiple lines' },
    });

    expect(textarea.style.height).toBe('72px');
    expect(textarea).toHaveClass('py-0', 'leading-5');
    expect(textarea.closest('[data-task-text-field]')).toHaveClass(
      'items-start',
      'pt-0.5',
      'pb-0',
    );
  });

  it('creates and focuses a child row with ArrowDown', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const frameCallbacks: FrameRequestCallback[] = [];

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    }) as typeof window.requestAnimationFrame;

    try {
      const callbacks = renderRow();
      render(<input data-item-id="new-item" aria-label="Created child" />);
      const input = screen.getByDisplayValue('Existing item');

      fireEvent.change(input, { target: { value: 'Edited item' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(callbacks.onSaveText).toHaveBeenCalledWith('Edited item');
        expect(callbacks.onCreateChild).toHaveBeenCalledOnce();
      });

      act(() => {
        while (frameCallbacks.length > 0) {
          frameCallbacks.shift()?.(0);
        }
      });

      expect(screen.getByLabelText('Created child')).toHaveFocus();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('uses the same category adapter for individual rows', () => {
    const callbacks = renderRow({
      categoryTagMap: new Map([
        ['category-1', { colorHex: '#ff0000', name: 'Focus' }],
      ]),
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Assign category' }));
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(callbacks.onAssignCategory).toHaveBeenCalledWith('category-1');
  });

  it('places clear category immediately below assign category', () => {
    renderRow({
      categoryTagId: 'category-1',
      categoryTagMap: new Map([
        ['category-1', { colorHex: '#ff0000', name: 'Focus' }],
      ]),
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    const assignCategory = screen.getByRole('button', {
      name: 'Assign category',
    });
    const clearCategory = screen.getByRole('button', {
      name: 'Clear category',
    });

    expect(assignCategory.nextElementSibling).toBe(clearCategory);
  });

  it('matches the bulk action labels and icons in the more actions menu', () => {
    renderRow({
      categoryTagId: 'category-1',
      categoryTagMap: new Map([
        ['category-1', { colorHex: '#ff0000', name: 'Focus' }],
      ]),
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    const priority = screen.getByRole('button', {
      name: 'Mark as priority',
    });
    const bold = screen.getByRole('button', { name: 'Make text bold' });
    const category = screen.getByRole('button', { name: 'Assign category' });
    const clearCategory = screen.getByRole('button', {
      name: 'Clear category',
    });
    const deleteItem = screen.getByRole('button', { name: 'Delete item' });

    expect(priority).toHaveTextContent('Priority');
    expect(priority.querySelector('.lucide-star')).not.toBeNull();
    expect(bold).toHaveTextContent('Bold');
    expect(
      bold.querySelector('[data-testid="task-bold-indicator"]'),
    ).not.toBeNull();
    expect(category).toHaveTextContent('Category');
    expect(category.querySelector('.lucide-tag')).not.toBeNull();
    expect(clearCategory).toHaveTextContent('Clear category');
    expect(
      clearCategory.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategory.querySelector('.lucide-x')).toBeNull();
    expect(deleteItem).toHaveTextContent('Delete');
    expect(deleteItem.querySelector('.lucide-trash-2')).not.toBeNull();
  });

  it('opens categories as a right-side hover extension aligned to the category option', () => {
    renderRow({
      categoryTagMap: new Map([
        ['category-1', { colorHex: '#ff0000', name: 'Focus' }],
      ]),
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const categoryButton = screen.getByRole('button', {
      name: 'Assign category',
    });
    vi.spyOn(categoryButton, 'getBoundingClientRect').mockReturnValue({
      bottom: 140,
      height: 40,
      left: 100,
      right: 300,
      top: 100,
      width: 200,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    const actionsMenu = categoryButton.closest(
      '[data-task-actions-menu="true"]',
    );
    vi.spyOn(actionsMenu!, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 280,
      left: 80,
      right: 328,
      top: 20,
      width: 248,
      x: 80,
      y: 20,
      toJSON: () => ({}),
    });

    fireEvent.mouseEnter(categoryButton);

    const extension = screen
      .getByRole('button', { name: 'Focus' })
      .closest('[data-task-category-submenu="true"]');

    expect(extension).toHaveClass(
      'dropdown-extension-panel',
      'rounded-l-none',
      'modal-panel--flat',
      'z-50',
    );
    expect(extension).not.toHaveClass('z-70');
    expect(extension).not.toHaveClass('border-0');
    expect(actionsMenu).toHaveClass('dropdown-joined-main');
    expect(screen.getByRole('button', { name: 'Focus' })).not.toHaveClass(
      'bg-white/[0.06]',
    );
    expect(extension).toHaveStyle({
      left: '327px',
      top: '120px',
      transform: 'translateY(-50%)',
    });
  });

  it('keeps selection, add, move, indent, and more actions visible in that order', () => {
    const callbacks = renderRow({
      selection: {
        isSelected: false,
        isSelectionMode: false,
        onBulkAssignCategory: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkToggleChecked: vi.fn(),
        onToggle: vi.fn(),
      },
    });

    const actionGroup = screen.getByRole('button', {
      name: 'More actions',
    }).parentElement?.parentElement;
    const labels = Array.from(
      actionGroup?.querySelectorAll('button') ?? [],
    ).map((button) => button.getAttribute('aria-label'));

    expect(labels).toEqual([
      'Select item',
      'Add child',
      'Move item up',
      'Move item down',
      'Outdent item',
      'Indent item',
      'More actions',
    ]);
    expect(screen.queryByLabelText('Mark as priority')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete item')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Move item up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move item down' }));

    expect(callbacks.onMoveUp).toHaveBeenCalledOnce();
    expect(callbacks.onMoveDown).toHaveBeenCalledOnce();
  });

  it('places actions on the row, in the menu, or hides them', () => {
    renderRow({
      actionPreferences: {
        ...defaultTaskTreeRowActionPreferences,
        add: 'menu',
        delete: 'hidden',
        priority: 'inline',
      },
      selection: {
        isSelected: false,
        isSelectionMode: false,
        onBulkAssignCategory: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkToggleChecked: vi.fn(),
        onToggle: vi.fn(),
      },
    });

    expect(screen.getByRole('button', { name: 'Select item' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Mark as priority' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add child' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.getByRole('button', { name: 'Add child' })).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'Mark as priority' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Delete item' }),
    ).not.toBeInTheDocument();
  });

  it('can hide drag and the scheduled time field', () => {
    renderRow({
      actionPreferences: {
        ...defaultTaskTreeRowActionPreferences,
        drag: false,
        scheduledTime: false,
      },
      showScheduledTime: true,
    });

    expect(screen.queryByRole('button', { name: 'Drag item' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Task time' })).toBeNull();
  });

  it('hides the three-dot button when no action is assigned to its menu', () => {
    renderRow({
      actionPreferences: {
        ...defaultTaskTreeRowActionPreferences,
        bold: 'hidden',
        category: 'inline',
        clearCategory: 'inline',
        delete: 'hidden',
        priority: 'inline',
      },
    });

    expect(
      screen.queryByRole('button', { name: 'More actions' }),
    ).not.toBeInTheDocument();
  });

  it('shows only one category control when the item has a category', () => {
    renderRow({
      actionPreferences: {
        ...defaultTaskTreeRowActionPreferences,
        category: 'inline',
      },
      categoryTagId: 'category-1',
      categoryTagMap: new Map([
        ['category-1', { colorHex: '#ff0000', name: 'Focus' }],
      ]),
    });

    expect(
      screen.getAllByRole('button', { name: 'Assign category' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Clear category' }),
    ).not.toBeInTheDocument();
  });

  it('uses the same hover treatment for inline category and other row actions', () => {
    renderRow({
      actionPreferences: {
        ...defaultTaskTreeRowActionPreferences,
        category: 'inline',
      },
    });

    const addButton = screen.getByRole('button', { name: 'Add child' });
    const categoryButton = screen.getByRole('button', {
      name: 'Assign category',
    });

    expect(categoryButton).toHaveClass(
      'hover:bg-white/[0.08]',
      'hover:text-[#fff9f2]',
      'rounded-full',
    );
    expect(categoryButton).toHaveClass(
      ...addButton.className
        .split(' ')
        .filter((className) => className.startsWith('hover:')),
    );
  });

  it('disables every row action except selection while selection mode is active', () => {
    renderRow({
      depth: 1,
      hasChildren: true,
      selection: {
        isSelected: true,
        isSelectionMode: true,
        onBulkAssignCategory: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkToggleChecked: vi.fn(),
        onToggle: vi.fn(),
      },
    });

    expect(screen.getByRole('button', { name: 'Deselect item' })).toBeEnabled();
    expect(screen.getByRole('checkbox')).toBeEnabled();

    for (const label of [
      'Collapse item',
      'Drag item',
      'Add child',
      'Move item up',
      'Move item down',
      'Outdent item',
      'Indent item',
      'More actions',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
  });

  it('renders a drag handle alongside move up and down buttons', () => {
    renderRow();
    const dragHandle = screen.getByLabelText('Drag item');

    expect(dragHandle).toBeInTheDocument();
    expect(screen.getByLabelText('Move item up')).toBeInTheDocument();
    expect(screen.getByLabelText('Move item down')).toBeInTheDocument();
  });

  it('shows a child drop target through the center of a row', async () => {
    const callbacks = renderRow();
    const row = screen.getByDisplayValue('Existing item').closest('.group');
    const dataTransfer = {
      effectAllowed: '',
      getData: () => 'other-item',
      setData: vi.fn(),
    };

    expect(row).not.toBeNull();
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    fireEvent.dragOver(row as Element, { clientY: 50, dataTransfer });

    expect(row).toHaveAttribute('data-drop-position', 'child');

    fireEvent.drop(row as Element, { clientY: 50, dataTransfer });

    await waitFor(() => {
      expect(callbacks.onMoveTo).toHaveBeenCalledWith({
        itemId: 'other-item',
        placement: 'child',
        targetItemId: 'item-1',
      });
    });
  });

  it('uses the next item as the only divider between siblings', () => {
    renderRow({ isLastSibling: false });
    const row = screen.getByDisplayValue('Existing item').closest('.group');

    expect(row).not.toBeNull();
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    fireEvent.dragOver(row as Element, {
      clientY: 90,
      dataTransfer: { getData: () => 'other-item' },
    });

    expect(row).toHaveAttribute('data-drop-position', 'child');
  });

  it('does not show a child drop target on the current parent', () => {
    renderRow({ itemId: 'parent-item', parentId: null });
    const row = screen.getByDisplayValue('Existing item').closest('.group');

    expect(row).not.toBeNull();
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    fireEvent.dragOver(row as Element, {
      clientY: 50,
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-tick-task-parent-id'
            ? 'parent-item'
            : 'child-item',
      },
    });

    expect(row).not.toHaveAttribute('data-drop-position');
  });

  it('does not show a drop target on the dragged item itself', () => {
    renderRow();
    const row = screen.getByDisplayValue('Existing item').closest('.group');

    expect(row).not.toBeNull();

    fireEvent.dragOver(row as Element, {
      clientY: 50,
      dataTransfer: { getData: () => 'item-1' },
    });

    expect(row).not.toHaveAttribute('data-drop-position');
  });

  it('clears a previous drop guide when that row starts being dragged', () => {
    renderRow();
    const row = screen.getByDisplayValue('Existing item').closest('.group');

    expect(row).not.toBeNull();
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    fireEvent.dragOver(row as Element, {
      clientY: 50,
      dataTransfer: { getData: () => 'other-item' },
    });
    expect(row).toHaveAttribute('data-drop-position', 'child');

    fireEvent.dragStart(screen.getByLabelText('Drag item'), {
      dataTransfer: { setData: vi.fn() },
    });

    expect(row).not.toHaveAttribute('data-drop-position');
  });

  it('does not offer an adjacent sibling position that changes nothing', () => {
    const siblingIds = ['previous-item', 'source-item'];
    renderRow({ itemId: 'source-item', siblingIds });
    renderRow({ itemId: 'previous-item', siblingIds });
    const dataTransfer = {
      effectAllowed: '',
      getData: () => '',
      setData: vi.fn(),
    };
    const previousRow = screen
      .getAllByDisplayValue('Existing item')[1]
      .closest('.group');

    expect(previousRow).not.toBeNull();

    fireEvent.dragStart(screen.getAllByLabelText('Drag item')[0], {
      dataTransfer,
    });
    fireEvent.dragOver(previousRow as Element, { dataTransfer });

    expect(previousRow).not.toHaveAttribute('data-drop-position');
  });

  it('keeps valid guides visible when dragover cannot read DataTransfer', () => {
    renderRow({ itemId: 'source-item' });
    renderRow({ itemId: 'target-item' });
    const dataTransfer = {
      effectAllowed: '',
      getData: () => '',
      setData: vi.fn(),
    };
    const targetRow = screen
      .getAllByDisplayValue('Existing item')[1]
      .closest('.group');

    expect(targetRow).not.toBeNull();
    Object.defineProperty(targetRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    fireEvent.dragStart(screen.getAllByLabelText('Drag item')[0], {
      dataTransfer,
    });
    fireEvent.dragOver(targetRow as Element, { clientY: 50, dataTransfer });

    expect(targetRow).toHaveAttribute('data-drop-position', 'child');
  });

  it('masks the optional calendar time input as 24-hour HH:mm', async () => {
    const callbacks = renderRow({
      scheduledTime: '',
      showScheduledTime: true,
    });

    const timeInput = screen.getByLabelText('Task time');

    expect(timeInput).toHaveClass('h-6', 'w-[4rem]', 'px-1.5', 'ml-2');

    fireEvent.change(timeInput, { target: { value: '2961abc' } });
    expect(timeInput).toHaveValue('23:59');

    await waitFor(() => {
      expect(callbacks.onSaveTime).toHaveBeenCalledWith('23:59');
    });
  });

  it('does not render the calendar time input by default', () => {
    renderRow();

    expect(screen.queryByLabelText('Task time')).not.toBeInTheDocument();
  });

  it('does not render the scheduled date trigger by default', () => {
    renderRow();

    expect(
      screen.queryByRole('button', {
        name: 'Open date picker for Task date',
      }),
    ).not.toBeInTheDocument();
  });

  it('hides the scheduled date trigger when the preference is off', () => {
    renderRow({
      actionPreferences: {
        ...defaultTaskTreeRowActionPreferences,
        scheduledDate: false,
      },
      showScheduledDate: true,
    });

    expect(
      screen.queryByRole('button', {
        name: 'Open date picker for Task date',
      }),
    ).not.toBeInTheDocument();
  });

  it('opens the date picker and saves the selected scheduled date', () => {
    const callbacks = renderRow({
      scheduledDate: '2026-07-15',
      showScheduledDate: true,
    });

    const trigger = screen.getByRole('button', {
      name: 'Open date picker for Task date',
    });

    expect(trigger).toHaveTextContent('15/07');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'July 20, 2026' }));

    expect(callbacks.onSaveDate).toHaveBeenCalledWith('2026-07-20');
  });

  it('clears the scheduled date from the picker popover', () => {
    const callbacks = renderRow({
      scheduledDate: '2026-07-15',
      showScheduledDate: true,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open date picker for Task date',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));

    expect(callbacks.onSaveDate).toHaveBeenCalledWith(null);
  });

  it('does not delete an empty row when Backspace is pressed', async () => {
    const callbacks = renderRow({ text: '' });
    const input = screen.getByPlaceholderText('Write a task');

    fireEvent.keyDown(input, { key: 'Backspace' });

    await waitFor(() => {
      expect(callbacks.onDelete).not.toHaveBeenCalled();
    });
  });

  it('applies checkbox bulk toggle when selection mode is active', async () => {
    const onBulkToggleChecked = vi.fn().mockResolvedValue(undefined);
    const callbacks = renderRow({
      selection: {
        isSelected: true,
        isSelectionMode: true,
        onBulkAssignCategory: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkToggleChecked,
        onToggle: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(onBulkToggleChecked).toHaveBeenCalledWith({
        completed: true,
        ignored: false,
      });
      expect(callbacks.onToggleChecked).not.toHaveBeenCalled();
    });
  });

  it('advances selected rows from completed to ignored in bulk', async () => {
    const onBulkToggleChecked = vi.fn().mockResolvedValue(undefined);
    const callbacks = renderRow({
      checked: true,
      ignored: false,
      selection: {
        isSelected: true,
        isSelectionMode: true,
        onBulkAssignCategory: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkToggleChecked,
        onToggle: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(onBulkToggleChecked).toHaveBeenCalledWith({
        completed: false,
        ignored: true,
      });
      expect(callbacks.onToggleChecked).not.toHaveBeenCalled();
    });
  });

  it('advances selected rows from ignored to unchecked in bulk', async () => {
    const onBulkToggleChecked = vi.fn().mockResolvedValue(undefined);
    renderRow({
      checked: false,
      ignored: true,
      selection: {
        isSelected: true,
        isSelectionMode: true,
        onBulkAssignCategory: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkToggleChecked,
        onToggle: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(onBulkToggleChecked).toHaveBeenCalledWith({
        completed: false,
        ignored: false,
      });
    });
  });
});
