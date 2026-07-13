import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskTreeEditableRow } from '@/components/app';

vi.mock('@/features/categories', () => ({
  CategoryAssignmentMenu: ({
    assignLabel,
    onAssign,
  }: {
    assignLabel: string;
    onAssign: (categoryTagId: string | null) => void;
  }) => (
    <button type="button" onClick={() => onAssign('category-1')}>
      {assignLabel}
    </button>
  ),
}));

const labels = {
  addChild: 'Add child',
  assignCategory: 'Assign category',
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
  dragItem: 'Drag item',
  itemTime: 'Task time',
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
    onMoveTo: vi.fn(),
    onMoveUp: vi.fn(),
    onOutdent: vi.fn(),
    onSaveText: vi.fn(),
    onToggleChecked: vi.fn().mockResolvedValue(undefined),
    onToggleCollapsed: vi.fn(),
    onTogglePriority: vi.fn().mockResolvedValue(undefined),
    onSaveTime: vi.fn(),
  };

  render(
    <TaskTreeEditableRow
      categoryTagId={null}
      categoryTagMap={new Map()}
      checked={false}
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
    />,
  );

  return callbacks;
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

    fireEvent.click(screen.getByLabelText('Mark as priority'));
    expect(callbacks.onTogglePriority).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Remove priority')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Delete item' })).toHaveClass(
      'mr-1',
    );
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
    const callbacks = renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Assign category' }));

    expect(callbacks.onAssignCategory).toHaveBeenCalledWith('category-1');
  });

  it('renders a drag handle instead of move up and down buttons', () => {
    renderRow();
    const dragHandle = screen.getByLabelText('Drag item');

    expect(dragHandle).toBeInTheDocument();
    expect(screen.queryByLabelText('Move item up')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move item down')).not.toBeInTheDocument();
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

    fireEvent.blur(timeInput);

    await waitFor(() => {
      expect(callbacks.onSaveTime).toHaveBeenCalledWith('23:59');
    });
  });

  it('does not render the calendar time input by default', () => {
    renderRow();

    expect(screen.queryByLabelText('Task time')).not.toBeInTheDocument();
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
      expect(onBulkToggleChecked).toHaveBeenCalledWith(true);
      expect(callbacks.onToggleChecked).not.toHaveBeenCalled();
    });
  });
});
