import {
  cleanup,
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
    onCreateChild: vi.fn(),
    onCreateSibling: vi.fn().mockResolvedValue('new-item'),
    onDelete: vi.fn(),
    onIndent: vi.fn(),
    onMoveDown: vi.fn(),
    onMoveUp: vi.fn(),
    onOutdent: vi.fn(),
    onSaveText: vi.fn(),
    onToggleChecked: vi.fn().mockResolvedValue(undefined),
    onToggleCollapsed: vi.fn(),
    onTogglePriority: vi.fn().mockResolvedValue(undefined),
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
      priority={false}
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

  it('uses the same category adapter for individual rows', () => {
    const callbacks = renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Assign category' }));

    expect(callbacks.onAssignCategory).toHaveBeenCalledWith('category-1');
  });
});
