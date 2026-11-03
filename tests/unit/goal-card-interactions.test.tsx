import {
  goal,
  group,
  groupGoalsTogetherMock,
  routerPushMock,
  scope,
  useCategoryTagsMock,
  useGoalGroupsMock,
  useGoalStepSummariesMock,
  useGoalsMock,
} from '../support/goals-surface-harness';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';
import { simulateClippedText } from '../support/truncation';

describe('GoalsSurface', () => {
  it('asks for the initial group name before combining two ungrouped goals', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({ id: 'goal-1', title: 'Focus' }),
        goal({ id: 'goal-2', title: 'Health' }),
      ];
    });

    render(<GoalsSurface />);

    const sourceGoal = screen.getByRole('button', { name: 'Focus' });
    const targetGoal = screen.getByRole('button', { name: 'Health' });
    const dragHandle = screen.getAllByLabelText('Drag goal')[0];
    const dragCard = dragHandle.closest('article');

    if (!dragCard) {
      throw new Error('Drag card not found');
    }

    dragCard.getBoundingClientRect = vi.fn(() => ({
      bottom: 120,
      height: 80,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }));

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetGoal),
    });

    fireEvent.pointerDown(dragHandle, {
      button: 0,
      clientX: 40,
      clientY: 60,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 120,
      clientY: 80,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, {
      clientX: 120,
      clientY: 80,
      pointerId: 1,
    });

    expect(
      screen.getByRole('dialog', { name: 'Create group' }),
    ).toBeInTheDocument();

    const input = screen.getByLabelText('Group name');

    expect(input).toHaveValue('NEW GROUP');

    input.focus();
    fireEvent.change(input, { target: { value: 'Health plan' } });

    expect(input).toHaveValue('HEALTH PLAN');
    expect(input).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() => {
      expect(groupGoalsTogetherMock).toHaveBeenCalledWith({
        scope,
        sourceGoalId: 'goal-1',
        targetGoalId: 'goal-2',
        title: 'HEALTH PLAN',
      });
    });

    expect(
      screen.queryByRole('dialog', { name: 'Create group' }),
    ).not.toBeInTheDocument();
    expect(sourceGoal).toBeInTheDocument();
  });

  it('renders groups as main cards with compact goal tiles', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' }),
        goal({ id: 'goal-2', title: 'Work', groupId: 'group-1' }),
      ];
    });

    render(<GoalsSurface />);

    const groupCard = screen.getByRole('button', { name: /LifeHealthWork/ });

    expect(groupCard).toBeInTheDocument();
    expect(groupCard).toHaveClass('h-32', 'pt-3.5', 'pb-5', 'gap-2');
    expect(screen.getByLabelText('Drag goal')).toHaveClass(
      'size-7',
      'rounded-full',
      'hover:bg-[#f0c38e]/14',
    );
    expect(screen.getByLabelText('Drag goal')).not.toHaveClass(
      'hover:bg-background',
    );
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Health').parentElement).toHaveClass(
      'px-4',
      'leading-tight',
    );
    expect(screen.queryByText('2 of 3 completed')).not.toBeInTheDocument();
  });

  it('keeps goal and group cards borderless at rest and draws the hover edge as a hairline', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' }),
        goal({ id: 'goal-2', title: 'Work' }),
      ];
    });

    render(<GoalsSurface />);

    const groupCard = screen.getByRole('button', { name: /LifeHealth/ });
    const goalCard = screen.getByRole('button', { name: 'Work' });

    expect(groupCard).toHaveClass('h-32');
    expect(goalCard).toHaveClass('h-32');

    for (const card of [groupCard, goalCard]) {
      expect(card).not.toHaveClass('ring-1');
      expect(card).toHaveClass(
        'inset-ring-hairline',
        'inset-ring-transparent',
        'hover:inset-ring-[#f0c38e]/25',
      );
    }
  });

  it('renders the goal step surface without a border around the container', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health' })];
    });

    const { container } = render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));

    const stepSurface = container.querySelector('section[aria-label="Health"]');

    expect(stepSurface).toBeInTheDocument();
    expect(stepSurface).not.toHaveClass('ring-1');
    expect(stepSurface).toHaveClass('rounded-[0.75rem]', 'bg-white/[0.035]');
  });

  it('opens group actions from a three-dot button without opening the group card', async () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal_group') {
        return [
          {
            id: 'group-category',
            name: 'Personal',
            colorHex: '#8b5cf6',
            position: '1',
            surface: 'goal_group',
          },
        ];
      }

      return [];
    });
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
      }),
    ]);

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Group actions' }));

    expect(routerPushMock).not.toHaveBeenCalled();
    expect(
      screen
        .getByLabelText('Assign independent color')
        .closest('[data-card-actions-menu="true"]'),
    ).toHaveClass('modal-panel--flat');
    expect(screen.getByLabelText('Assign independent color')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Assign category' }),
    ).toBeVisible();
    expect(
      screen
        .getByRole('button', { name: 'Assign category' })
        .querySelector('.lucide-tag'),
    ).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear group color/category',
    });
    expect(clearCategoryButton).toBeVisible();
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete group' })).toHaveClass(
      'text-rose-300',
    );

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete group' }),
      ).not.toBeInTheDocument();
    });
  });

  it('shows a named goal category in its color to the right of the goal title', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          categoryTagId: 'category-1',
        }),
      ];
    });

    render(<GoalsSurface />);

    const title = screen.getByText('Focus');
    const categoryName = screen.getByText('Modo local');

    expect(title.compareDocumentPosition(categoryName)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(categoryName).toHaveStyle({ color: '#f97316' });
    expect(categoryName).toHaveClass('truncate', 'text-xs', 'font-semibold');
  });

  it('shows the complete goal card name in the project tooltip', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({
          id: 'goal-1',
          title: 'A goal name that needs truncation',
          categoryTagId: null,
        }),
      ];
    });

    render(<GoalsSurface />);

    const title = screen.getByText('A goal name that needs truncation');
    const header = title.parentElement?.parentElement;
    const menu = screen.getByRole('button', { name: 'Goal actions' });

    expect(title).toHaveClass('truncate');
    expect(header).toHaveClass('flex', 'items-center');
    expect(menu.parentElement?.parentElement).toBe(header);
    simulateClippedText(title);
    fireEvent.mouseEnter(title.parentElement!);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'A goal name that needs truncation',
    );
  });

  it('renders the group category badge with the shared system badge pattern', () => {
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-1',
        name: 'Modo local',
        colorHex: '#f97316',
        position: '1',
        surface: 'goals',
      },
    ]);
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
        categoryTagId: 'category-1',
      }),
    ]);

    render(<GoalsSurface />);

    const badge = screen.getByText('Modo local').parentElement;

    expect(badge).toHaveClass(
      'inline-flex',
      'min-h-7',
      'items-center',
      'gap-2',
      'rounded-full',
      'inset-ring-hairline',
      'px-3',
      'py-1',
      'text-[0.68rem]',
      'font-semibold',
      'uppercase',
      'tracking-[0.24em]',
      'text-[#f7e8ce]',
      'shadow-sm',
      'shadow-[#253241]/10',
    );
    expect(badge).toHaveStyle({
      '--chip-edge': 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });
  });

  it('keeps the plain group task dot between truncated content and the menu', async () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal_group') {
        return [
          {
            id: 'group-category',
            name: 'A category name that needs truncation',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal_group',
            useOwnName: false,
          },
        ];
      }

      return [];
    });
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'A group name that needs truncation',
        categoryTagId: 'group-category',
      }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', groupId: 'group-1' })];
    });
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 0,
            itemCount: 1,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    const indicator = screen.getByTestId('goal-group-task-indicator-group-1');
    const title = screen.getByText('A group name that needs truncation');
    const categoryName = screen.getByText(
      'A category name that needs truncation',
    );
    const menu = screen.getByRole('button', { name: 'Group actions' });
    const header = indicator.parentElement;

    expect(indicator).toHaveAttribute('data-status', 'pending');
    expect(header).toHaveClass('flex', 'items-center');
    expect(menu.parentElement?.parentElement).toBe(header);
    expect(indicator).toHaveClass('size-2.5', 'bg-[#f0c38e]');
    expect(indicator).not.toHaveClass(
      'shadow-[0_0_10px_rgba(240,195,142,0.55)]',
    );
    expect(indicator.querySelector('svg')).toBeNull();
    expect(categoryName).toHaveClass('truncate');
    expect(categoryName.compareDocumentPosition(indicator)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(indicator.compareDocumentPosition(menu)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    simulateClippedText(title);
    fireEvent.mouseEnter(title.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'A group name that needs truncation',
    );
  });

  it('uses a plain green dot when every active group task is complete', () => {
    useGoalGroupsMock.mockReturnValue([group({ id: 'group-1' })]);
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived ? [] : [goal({ id: 'goal-1', groupId: 'group-1' })],
    );
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 2,
            itemCount: 2,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    const indicator = screen.getByTestId('goal-group-task-indicator-group-1');

    expect(indicator).toHaveAttribute('data-status', 'complete');
    expect(indicator).toHaveClass('bg-emerald-400');
    expect(indicator.querySelector('svg')).toBeNull();
  });

  it('uses a plain muted dot when a group has no active tasks', () => {
    useGoalGroupsMock.mockReturnValue([group({ id: 'group-1' })]);
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived ? [] : [],
    );

    render(<GoalsSurface />);

    const indicator = screen.getByTestId('goal-group-task-indicator-group-1');

    expect(indicator).toHaveAttribute('data-status', 'empty');
    expect(indicator).toHaveClass('bg-[#66717f]');
    expect(indicator).not.toHaveClass('inset-ring-hairline');
  });

  it('wraps the group name in a color pill instead of showing a dot when useOwnName is true', () => {
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-1',
        name: '',
        colorHex: '#f97316',
        position: '1',
        surface: 'goals',
        useOwnName: true,
      },
    ]);
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-1',
        title: 'Life',
        categoryTagId: 'category-1',
      }),
    ]);

    const { container } = render(<GoalsSurface />);

    expect(screen.queryByText('Modo local')).not.toBeInTheDocument();

    const pill = screen.getByText('Life').parentElement;

    expect(pill).toHaveClass('rounded-full', 'inset-ring-hairline');
    expect(pill).toHaveStyle({
      '--chip-edge': 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });

    const dot = Array.from(container.querySelectorAll('span')).find(
      (element) =>
        element.className.includes('inset-ring-white/30') &&
        element.className.includes('rounded-full'),
    );

    expect(dot).toBeUndefined();
  });
});
