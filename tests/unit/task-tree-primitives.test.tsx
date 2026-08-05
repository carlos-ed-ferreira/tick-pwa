import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  TaskTreeActionGroup,
  TaskTreeCategoryChip,
  TaskTreeCollapseButton,
  TaskTreeRowLayout,
  TaskTreeSelectionButton,
  TreeListPanel,
} from '@/components/app';

describe('task tree primitives', () => {
  it('keeps the category color while adding an amber priority glow', () => {
    render(
      <TaskTreeRowLayout categoryColorHex="#22c55e" depth={2} isPriority>
        <span>Checklist row</span>
      </TaskTreeRowLayout>,
    );

    const row = screen.getByText('Checklist row').parentElement;

    expect(row).toHaveClass(
      'group',
      'flex',
      'min-w-0',
      'items-center',
      'gap-1',
      'min-h-11',
      'rounded-lg',
      'inset-ring-hairline',
      'inset-ring-transparent',
      'p-0',
      'transition',
      'hover:inset-ring-white/[0.08]',
      'hover:bg-white/[0.055]',
    );
    expect(row).toHaveStyle({
      paddingLeft: '28px',
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      boxShadow:
        'inset 4px 0 0 0 rgba(240, 195, 142, 1), inset 0 0 18px rgba(240, 195, 142, 0.12)',
    });
  });

  it('adds the same amber priority glow without a category color', () => {
    render(
      <TaskTreeRowLayout depth={0} isPriority>
        <span>Priority row</span>
      </TaskTreeRowLayout>,
    );

    expect(screen.getByText('Priority row').parentElement).toHaveStyle({
      boxShadow:
        'inset 4px 0 0 0 rgba(240, 195, 142, 1), inset 0 0 18px rgba(240, 195, 142, 0.12)',
    });
  });

  it('dims and blocks the collapse button when a row has no children', () => {
    const onClick = vi.fn();

    render(
      <TaskTreeCollapseButton
        collapseLabel="Collapse item"
        expandLabel="Expand item"
        hasChildren={false}
        isCollapsed={false}
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: 'Collapse item' });

    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      'disabled:cursor-not-allowed',
      'disabled:opacity-40',
    );

    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls the collapse button callback for expandable rows', () => {
    const onClick = vi.fn();

    render(
      <TaskTreeCollapseButton
        collapseLabel="Collapse item"
        expandLabel="Expand item"
        hasChildren
        isCollapsed
        onClick={onClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand item' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the category chip with category colors', () => {
    render(<TaskTreeCategoryChip colorHex="#f97316" name="Home" />);

    const chip = screen.getByText('Home');

    expect(chip).toHaveClass(
      'shrink-0',
      'rounded-full',
      'inset-ring-hairline',
      'px-2',
      'py-1',
      'text-[11px]',
      'font-medium',
      'leading-none',
    );
    expect(chip).toHaveStyle({
      '--chip-edge': '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.18)',
      color: '#f97316',
    });
  });

  it('passes shift-click state through the selection button', () => {
    const onToggle = vi.fn();

    render(
      <TaskTreeSelectionButton
        deselectLabel="Deselect item"
        isSelected={false}
        selectLabel="Select item"
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole('button', { name: 'Select item' });
    fireEvent.click(button, { shiftKey: true });

    expect(button).toHaveClass(
      'group',
      'inline-flex',
      'size-9',
      'shrink-0',
      'items-center',
      'justify-center',
      'rounded-md',
      'transition',
      'hover:bg-white/[0.08]',
      'hover:text-[#fff9f2]',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-[#f0c38e]',
    );
    expect(button.querySelector('span')).not.toHaveClass(
      'group-hover:bg-[#f0c38e]/14',
    );
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('renders the selected state marker', () => {
    render(
      <TaskTreeSelectionButton
        deselectLabel="Deselect item"
        isSelected
        selectLabel="Select item"
        onToggle={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Deselect item' });
    const marker = button.querySelector('span');

    expect(marker).toHaveClass(
      'bg-[#f0c38e]',
      'text-[#141e2a]',
      'shadow-[0_8px_18px_rgba(240,195,142,0.24)]',
    );
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the action group wrapper classes', () => {
    render(
      <TaskTreeActionGroup>
        <button type="button">Action</button>
      </TaskTreeActionGroup>,
    );

    expect(
      screen.getByRole('button', { name: 'Action' }).parentElement,
    ).toHaveClass('flex', 'shrink-0', 'items-center', 'gap-0');
  });

  it('adds temporary top padding only for the top divider', () => {
    render(
      <TreeListPanel
        addLabel="Add item"
        clearSelectionLabel="Clear selection"
        emptyLabel="Empty"
        hasRows
        isSelectionMode={false}
        onAddRoot={vi.fn()}
        onClearSelection={vi.fn()}
      >
        <div data-tree-row>Checklist row</div>
      </TreeListPanel>,
    );

    const panel = screen.getByTestId('tree-list-panel');
    const row = panel.querySelector('[data-tree-row]');

    expect(row).not.toBeNull();

    Object.defineProperty(row as Element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 100, top: 0 }),
    });

    expect(panel).toHaveClass('pt-2');
    fireEvent(
      row as Element,
      new MouseEvent('dragover', { bubbles: true, clientY: 10 }),
    );
    expect(panel).toHaveClass('pt-3');

    fireEvent(
      row as Element,
      new MouseEvent('dragover', { bubbles: true, clientY: 50 }),
    );
    expect(panel).toHaveClass('pt-2');

    fireEvent.dragEnd(panel);
    expect(panel).toHaveClass('pt-2');
  });
});
