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
  applyToOtherSurface: 'Also apply to goal steps',
  close: 'Close',
  configure: 'Configure row actions',
  hidden: 'Hidden',
  inline: 'On row',
  menu: 'Extra options',
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

    expect(dialog).toHaveClass('border-0', 'after:hidden');
    expect(dialog.querySelector('[data-row-action-setting]')).not.toHaveClass(
      'inset-ring-hairline',
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
        name: 'Priority: Extra options',
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
        name: 'Drag and drop: Extra options',
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
      'inset-ring-[#f0c38e]/22',
      'bg-[#f0c38e]/10',
      'text-[#f7d7ad]',
      'hover:inset-ring-[#f0c38e]/36',
      'hover:bg-[#f0c38e]/16',
    );
    fireEvent.click(resetButton);

    expect(onChange).toHaveBeenCalledWith(defaultTaskTreeRowActionPreferences);
  });

  it('can apply the current and subsequent preferences to the other surface', () => {
    const onApplyToOtherSurface = vi.fn();
    const onChange = vi.fn();

    render(
      <TaskTreeRowActionsMenu
        labels={labels}
        value={defaultTaskTreeRowActionPreferences}
        onApplyToOtherSurface={onApplyToOtherSurface}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure row actions' }),
    );

    const checkbox = screen.getByRole('checkbox', {
      name: 'Also apply to goal steps',
    });
    const extraOptions = screen.getByRole('radio', {
      name: 'Priority: Extra options',
    });

    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveClass('inset-ring-[#f0c38e]/55', 'bg-[#f0c38e]/12');
    expect(extraOptions).toHaveClass('whitespace-nowrap');
    expect(extraOptions.parentElement).toHaveClass('sm:w-[24rem]');

    fireEvent.click(checkbox);
    expect(onApplyToOtherSurface).toHaveBeenCalledWith(
      defaultTaskTreeRowActionPreferences,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Priority: On row' }));
    const updatedPreferences = {
      ...defaultTaskTreeRowActionPreferences,
      priority: 'inline' as const,
    };

    expect(onChange).toHaveBeenCalledWith(updatedPreferences);
    expect(onApplyToOtherSurface).toHaveBeenLastCalledWith(updatedPreferences);
  });
});
