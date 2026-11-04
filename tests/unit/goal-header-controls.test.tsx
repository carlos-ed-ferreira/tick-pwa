import {
  goal,
  group,
  useCategoryTagsMock,
  useGoalGroupsMock,
  useGoalsMock,
} from '../support/goals-surface-harness';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';
import { stubPointerCapability } from '../support/pointer';

function expectFilledRoundControl(element: HTMLElement) {
  expect(element).toHaveClass('rounded-full', 'size-10');
  expect(element).not.toHaveClass('rounded-md');
  expect(element.className).not.toContain('inset-ring');
}

function expectFilledPillControl(element: HTMLElement) {
  expect(element).toHaveClass('rounded-full', 'bg-white/8');
  expect(element.className).not.toContain('inset-ring');
}

const assignedCategory = {
  id: 'category-1',
  name: 'Modo local',
  colorHex: '#f97316',
  position: '1',
};

describe('goal header controls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the group header controls as filled borderless round buttons and a short back pill', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) =>
      surface === 'goal_group'
        ? [{ ...assignedCategory, surface: 'goal_group' }]
        : [],
    );
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', categoryTagId: 'category-1' }),
    ]);
    window.history.replaceState({}, '', '/goals?group=group-1');

    render(<GoalsSurface />);

    for (const name of [
      'Assign group category',
      'Clear group color/category',
      'Delete group',
    ]) {
      expectFilledRoundControl(screen.getByRole('button', { name }));
    }
    expectFilledRoundControl(
      screen.getByLabelText('Assign independent color').parentElement!,
    );
    expectFilledPillControl(screen.getByRole('button', { name: 'Categories' }));

    const backButton = screen.getByRole('button', { name: 'Back' });

    expect(backButton).toHaveTextContent(/^Back$/);
    expectFilledPillControl(backButton);
  });

  it('renders the goal header controls as filled borderless round buttons and a short back pill', () => {
    stubPointerCapability(false);
    useCategoryTagsMock.mockImplementation((_scope, surface) =>
      surface === 'goal' ? [{ ...assignedCategory, surface: 'goal' }] : [],
    );
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived
        ? []
        : [goal({ id: 'goal-1', title: 'Focus', categoryTagId: 'category-1' })],
    );
    window.history.replaceState({}, '', '/goals?goal=goal-1');

    render(<GoalsSurface />);

    for (const name of [
      'Assign goal category',
      'Clear goal color/category',
      'Open date picker for Goal date',
      'Archive goal',
      'Delete goal',
    ]) {
      expectFilledRoundControl(screen.getByRole('button', { name }));
    }
    expectFilledRoundControl(
      screen.getByLabelText('Assign independent color').parentElement!,
    );
    expectFilledPillControl(screen.getByRole('button', { name: 'Categories' }));

    const backButton = screen.getByRole('button', { name: 'Back' });

    expect(backButton).toHaveTextContent(/^Back$/);
    expectFilledPillControl(backButton);
  });

  it('renders the goal detail actions trigger on touch as a filled borderless round button', () => {
    stubPointerCapability(true);
    window.history.replaceState({}, '', '/goals?goal=goal-1');

    render(<GoalsSurface />);

    expectFilledRoundControl(
      screen.getByRole('button', { name: 'More options' }),
    );
  });

  it('rounds the hover surface of the goal and group card menus', () => {
    useGoalGroupsMock.mockReturnValue([group({ id: 'group-1' })]);

    render(<GoalsSurface />);

    for (const name of ['Goal actions', 'Group actions']) {
      const menu = screen.getByRole('button', { name });

      expect(menu).toHaveClass('rounded-full');
      expect(menu).not.toHaveClass('rounded-md');
    }
  });
});
