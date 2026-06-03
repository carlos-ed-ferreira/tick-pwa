import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  TaskTreeActionGroup,
  TaskTreeCategoryChip,
  TaskTreeCollapseButton,
  TaskTreeRowLayout,
  TaskTreeSelectionButton,
} from '@/components/app';

describe('task tree primitives', () => {
  it('renders the row layout with the same spacing and highlight styles', () => {
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
      'rounded-xl',
      'border',
      'border-transparent',
      'px-1',
      'py-1',
      'transition',
      'hover:border-white/[0.08]',
      'hover:bg-white/[0.055]',
    );
    expect(row).toHaveStyle({
      paddingLeft: 'min(32px, 56px)',
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      boxShadow: 'inset 4px 0 0 0 rgba(240, 195, 142, 0.98)',
    });
  });

  it('renders the collapse button disabled when a row has no children', () => {
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
    expect(button).toHaveClass('disabled:opacity-100');
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
      'border',
      'px-2',
      'py-1',
      'text-[11px]',
      'font-medium',
      'leading-none',
    );
    expect(chip).toHaveStyle({
      borderColor: '#f97316',
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
      'rounded-full',
      'transition',
      'hover:bg-white/[0.08]',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-[#f0c38e]',
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
      'text-[#241735]',
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
});
