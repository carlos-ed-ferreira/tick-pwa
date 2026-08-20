import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskTreeBulkActions } from '@/components/app/task-tree-bulk-actions';
import { defaultTaskTreeRowActionPreferences } from '@/components/app/task-tree-row-action-visibility';

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    scope: {
      id: 'guest:test',
      kind: 'guest',
      ownerId: 'test',
    },
  }),
}));

vi.mock('@/features/categories/use-category-tags', () => ({
  useCategoryTags: () => [
    {
      id: 'category-home',
      name: 'Home',
      colorHex: '#f59e0b',
      useOwnName: false,
    },
    {
      id: 'category-health',
      name: 'Health',
      colorHex: '#4b6f52',
      useOwnName: false,
    },
  ],
}));

describe('TaskTreeBulkActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps a stable label while cycling the selected completion state', async () => {
    const onToggleChecked = vi.fn();

    const { container, rerender } = render(
      <TaskTreeBulkActions
        allBold={false}
        allPriority={false}
        completionState="unchecked"
        labels={{
          bold: 'Bold',
          category: 'Category',
          clearCategory: 'Clear category',
          delete: 'Delete',
          priority: 'Priority',
          mark: 'Mark',
          selected: '2 selected',
        }}
        surface="checklist_item"
        onAssignCategory={vi.fn()}
        onDelete={vi.fn()}
        onToggleBold={vi.fn()}
        onToggleChecked={onToggleChecked}
        onTogglePriority={vi.fn()}
      />,
    );

    const uncheckedIndicator = container.querySelector('.tick-checkbox');

    expect(uncheckedIndicator).not.toBeNull();
    expect(uncheckedIndicator).toHaveClass('size-4');
    expect(uncheckedIndicator).not.toHaveAttribute('data-checked');
    expect(uncheckedIndicator).not.toHaveAttribute('data-ignored');

    fireEvent.click(screen.getByRole('button', { name: 'Mark · 2 selected' }));

    await waitFor(() => {
      expect(onToggleChecked).toHaveBeenCalledWith({
        completed: true,
        ignored: false,
      });
    });

    rerender(
      <TaskTreeBulkActions
        allBold={false}
        allPriority={false}
        completionState="completed"
        labels={{
          bold: 'Bold',
          category: 'Category',
          clearCategory: 'Clear category',
          delete: 'Delete',
          priority: 'Priority',
          mark: 'Mark',
          selected: '2 selected',
        }}
        surface="checklist_item"
        onAssignCategory={vi.fn()}
        onDelete={vi.fn()}
        onToggleBold={vi.fn()}
        onToggleChecked={onToggleChecked}
        onTogglePriority={vi.fn()}
      />,
    );

    expect(container.querySelector('.tick-checkbox')).toHaveAttribute(
      'data-checked',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark · 2 selected' }));

    await waitFor(() => {
      expect(onToggleChecked).toHaveBeenLastCalledWith({
        completed: false,
        ignored: true,
      });
    });

    rerender(
      <TaskTreeBulkActions
        allBold={false}
        allPriority={false}
        completionState="ignored"
        labels={{
          bold: 'Bold',
          category: 'Category',
          clearCategory: 'Clear category',
          delete: 'Delete',
          priority: 'Priority',
          mark: 'Mark',
          selected: '2 selected',
        }}
        surface="checklist_item"
        onAssignCategory={vi.fn()}
        onDelete={vi.fn()}
        onToggleBold={vi.fn()}
        onToggleChecked={onToggleChecked}
        onTogglePriority={vi.fn()}
      />,
    );

    expect(container.querySelector('.tick-checkbox')).toHaveAttribute(
      'data-ignored',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark · 2 selected' }));

    await waitFor(() => {
      expect(onToggleChecked).toHaveBeenLastCalledWith({
        completed: false,
        ignored: false,
      });
    });
  });

  it('uses the shared button style and keeps clear category outside the menu', async () => {
    const onAssignCategory = vi.fn();

    render(
      <TaskTreeBulkActions
        allBold={false}
        allPriority={false}
        completionState="unchecked"
        labels={{
          bold: 'Bold',
          category: 'Category',
          clearCategory: 'Clear category',
          delete: 'Delete',
          priority: 'Priority',
          mark: 'Mark',
          selected: '2 selected',
        }}
        surface="checklist_item"
        onAssignCategory={onAssignCategory}
        onDelete={vi.fn()}
        onToggleBold={vi.fn()}
        onToggleChecked={vi.fn()}
        onTogglePriority={vi.fn()}
      />,
    );

    const priorityButton = screen.getByRole('button', {
      name: 'Priority · 2 selected',
    });
    const categoryButton = screen.getByRole('button', {
      name: 'Category · 2 selected',
    });
    const clearButton = screen.getByRole('button', {
      name: 'Clear category · 2 selected',
    });

    expect(categoryButton.className).toBe(priorityButton.className);
    expect(clearButton.closest('[data-tree-selection-actions]')).not.toBeNull();
    expect(
      clearButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearButton.querySelector('.lucide-x')).toBeNull();

    fireEvent.click(categoryButton);

    const categoryOption = await screen.findByRole('button', { name: 'Home' });
    const menu = categoryOption.parentElement;

    expect(menu).toHaveStyle({ width: '288px' });
    expect(menu?.querySelectorAll('button')).toHaveLength(2);
    expect(menu).not.toContainElement(clearButton);

    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(onAssignCategory).toHaveBeenCalledWith(null);
    });
  });

  it('omits collective actions configured as hidden everywhere', () => {
    render(
      <TaskTreeBulkActions
        actionPreferences={{
          ...defaultTaskTreeRowActionPreferences,
          bold: 'hidden',
          category: 'hidden',
          clearCategory: 'hidden',
        }}
        allBold={false}
        allPriority={false}
        completionState="unchecked"
        labels={{
          bold: 'Bold',
          category: 'Category',
          clearCategory: 'Clear category',
          delete: 'Delete',
          priority: 'Priority',
          mark: 'Mark',
          selected: '2 selected',
        }}
        surface="checklist_item"
        onAssignCategory={vi.fn()}
        onDelete={vi.fn()}
        onToggleBold={vi.fn()}
        onToggleChecked={vi.fn()}
        onTogglePriority={vi.fn()}
      />,
    );

    expect(screen.getByText('2 selected')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Priority · 2 selected' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Delete · 2 selected' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Bold · 2 selected' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Category · 2 selected' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Clear category · 2 selected' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Mark · 2 selected' }),
    ).toBeVisible();
  });
});
