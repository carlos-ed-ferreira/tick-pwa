import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultTaskTreeRowActionPreferences,
  TaskTreeRowActionsMenu,
} from '@/components/app';

const labels = {
  actions: {
    add: 'Add child',
    bold: 'Bold',
    category: 'Category',
    clearCategory: 'Clear category',
    delete: 'Delete',
    drag: 'Drag and drop',
    indent: 'Indent item',
    moveDown: 'Move item down',
    moveUp: 'Move item up',
    outdent: 'Outdent item',
    priority: 'Priority',
    scheduledTime: 'Task time',
  },
  close: 'Close',
  configure: 'Configure row actions',
  hidden: 'Hidden',
  inline: 'On row',
  menu: 'Three-dot menu',
  reset: 'Restore defaults',
  title: 'Task row actions',
  visible: 'Visible',
};

describe('TaskTreeRowActionsMenu', () => {
  afterEach(cleanup);

  it('opens a modal with the five structural actions on the row by default', () => {
    render(
      <TaskTreeRowActionsMenu
        labels={labels}
        value={defaultTaskTreeRowActionPreferences}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure row actions' }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Task row actions' });

    expect(dialog).toHaveClass('modal-surface--flat');
    expect(dialog.querySelector('[data-row-action-setting]')).not.toHaveClass(
      'border',
    );

    for (const action of [
      'Add child',
      'Move item up',
      'Move item down',
      'Outdent item',
      'Indent item',
    ]) {
      expect(
        within(dialog).getByRole('radio', {
          name: `${action}: On row`,
          checked: true,
        }),
      ).toBeInTheDocument();
    }
    expect(
      within(dialog).getByRole('radio', {
        name: 'Priority: Three-dot menu',
        checked: true,
      }),
    ).toBeInTheDocument();

    const choiceWidths = Array.from(
      dialog.querySelectorAll<HTMLElement>('[data-row-action-choice]'),
    ).map((choice) => choice.className);
    expect(
      choiceWidths.every((className) => className.includes('w-full')),
    ).toBe(true);
  });

  it('moves an action between row, menu, and hidden destinations', () => {
    const onChange = vi.fn();

    render(
      <TaskTreeRowActionsMenu
        labels={labels}
        value={defaultTaskTreeRowActionPreferences}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure row actions' }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Priority: On row' }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultTaskTreeRowActionPreferences,
      priority: 'inline',
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Delete: Hidden' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultTaskTreeRowActionPreferences,
      delete: 'hidden',
    });
  });

  it('offers drag and time as visible or hidden instead of menu destinations', () => {
    render(
      <TaskTreeRowActionsMenu
        labels={labels}
        value={defaultTaskTreeRowActionPreferences}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure row actions' }),
    );

    expect(
      screen.getByRole('radio', { name: 'Drag and drop: Visible' }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Task time: Visible' }),
    ).toBeChecked();
    expect(
      screen.queryByRole('radio', {
        name: 'Drag and drop: Three-dot menu',
      }),
    ).not.toBeInTheDocument();
  });

  it('omits task time when the current tree does not support scheduling', () => {
    render(
      <TaskTreeRowActionsMenu
        labels={labels}
        showScheduledTime={false}
        value={defaultTaskTreeRowActionPreferences}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure row actions' }),
    );

    expect(
      screen.queryByRole('radio', { name: 'Task time: Visible' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Drag and drop: Visible' }),
    ).toBeChecked();
  });

  it('restores every action to the default configuration', () => {
    const onChange = vi.fn();

    render(
      <TaskTreeRowActionsMenu
        labels={labels}
        value={{
          ...defaultTaskTreeRowActionPreferences,
          add: 'hidden',
          drag: false,
          priority: 'inline',
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure row actions' }),
    );
    const resetButton = screen.getByRole('button', {
      name: 'Restore defaults',
    });

    expect(resetButton).toHaveClass(
      'border-[#f0c38e]/22',
      'bg-[#f0c38e]/10',
      'text-[#f7d7ad]',
      'hover:border-[#f0c38e]/36',
      'hover:bg-[#f0c38e]/16',
    );
    fireEvent.click(resetButton);

    expect(onChange).toHaveBeenCalledWith(defaultTaskTreeRowActionPreferences);
  });
});
