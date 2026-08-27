import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskCompletionCheckbox } from '@/components/app/task-completion-checkbox';

const labels = {
  chooseCompletionState: 'Choose marking state',
  completionStateCompleted: 'Marked',
  completionStateIgnored: 'Ignored',
  completionStateLevel: 'Level {level} of {levels}',
  completionStateUnchecked: 'Unchecked',
  toggleItem: 'Toggle item',
};

function renderCheckbox({
  completionSettings = { ignored: false, levels: 1 },
  values = { completed: false, ignored: false, markLevel: 0 },
}: {
  completionSettings?: { ignored: boolean; levels: number };
  values?: { completed: boolean; ignored: boolean; markLevel: number };
} = {}) {
  const onSelect = vi.fn().mockResolvedValue(undefined);
  const onToggle = vi.fn().mockResolvedValue(undefined);

  render(
    <TaskCompletionCheckbox
      completionSettings={completionSettings}
      labels={labels}
      values={values}
      onSelect={onSelect}
      onToggle={onToggle}
    />,
  );

  return { onSelect, onToggle };
}

describe('TaskCompletionCheckbox', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps the plain toggle without a picker while only two states exist', () => {
    const { onToggle } = renderCheckbox();

    fireEvent.contextMenu(screen.getByRole('checkbox'));

    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('opens every configured state on right click and applies the chosen one', () => {
    const { onSelect, onToggle } = renderCheckbox({
      completionSettings: { ignored: true, levels: 3 },
      values: { completed: true, ignored: false, markLevel: 2 },
    });

    fireEvent.contextMenu(screen.getByRole('checkbox'));

    const options = screen
      .getAllByRole('menuitemradio')
      .map((option) => option.textContent);

    expect(options).toEqual([
      'Unchecked',
      'Level 1 of 3',
      'Level 2 of 3',
      'Level 3 of 3',
      'Ignored',
    ]);
    expect(
      screen.getByRole('menuitemradio', { name: 'Level 2 of 3' }),
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ignored' }));

    expect(onSelect).toHaveBeenCalledWith({
      completed: false,
      ignored: true,
      markLevel: 0,
    });
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the picker on touch long press without toggling the task', () => {
    vi.useFakeTimers();
    const { onToggle } = renderCheckbox({
      completionSettings: { ignored: false, levels: 3 },
    });
    const checkbox = screen.getByRole('checkbox');

    fireEvent.pointerDown(checkbox, {
      clientX: 10,
      clientY: 10,
      pointerType: 'touch',
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(checkbox, { pointerType: 'touch' });
    fireEvent.click(checkbox);

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('keeps the toggle when a touch press moves away before the picker opens', () => {
    vi.useFakeTimers();
    const { onToggle } = renderCheckbox({
      completionSettings: { ignored: false, levels: 3 },
    });
    const checkbox = screen.getByRole('checkbox');

    fireEvent.pointerDown(checkbox, {
      clientX: 10,
      clientY: 10,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(checkbox, {
      clientX: 10,
      clientY: 60,
      pointerType: 'touch',
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(checkbox);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('names the current level for assistive technology', () => {
    renderCheckbox({
      completionSettings: { ignored: false, levels: 5 },
      values: { completed: true, ignored: false, markLevel: 4 },
    });

    expect(
      screen.getByRole('checkbox', { name: 'Toggle item: Level 4 of 5' }),
    ).toHaveAttribute('data-mark-level', '4');
  });
});
