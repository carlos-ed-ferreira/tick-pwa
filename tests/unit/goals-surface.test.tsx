import {
  createGoalMock,
  goal,
  goalStep,
  group,
  routerPushMock,
  scope,
  softDeleteGoalMock,
  useCategoryTagsMock,
  useGoalGroupsMock,
  useGoalStepSummariesMock,
  useGoalStepTreeMock,
  useGoalsMock,
} from '../support/goals-surface-harness';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoalsSurface } from '@/features/goals';
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';

describe('GoalsSurface', () => {
  it('uses the requested pt-BR labels in the goal card menu', () => {
    expect(ptBRDictionary.goalStepEditor.itemSelected).toBe(
      '{count} etapa selecionada',
    );
    expect(ptBRDictionary.goalStepEditor.itemsSelected).toBe(
      '{count} etapas selecionadas',
    );
    expect(ptBRDictionary.goalStepEditor.confirmBulkDeleteItem).toBe(
      'Você está prestes a excluir {count} etapa selecionada.',
    );
    expect(ptBRDictionary.goalStepEditor.confirmBulkDeleteItems).toBe(
      'Você está prestes a excluir {count} etapas selecionadas.',
    );
    expect(ptBRDictionary.goals.assignGoalColor).toBe(
      'Atribuir cor independente',
    );
    expect(ptBRDictionary.goals.assignGoalCategoryMenu).toBe(
      'Atribuir categoria',
    );
    expect(ptBRDictionary.goals.clearGoalCategory).toBe(
      'Limpar cor/categoria da meta',
    );
    expect(ptBRDictionary.goals.moveTo).toBe('Mover para');
  });

  it('shows the ignored step count when every step of the goal is ignored', () => {
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 0,
            itemCount: 0,
            ignoredCount: 3,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    expect(screen.getByText('3 ignored')).toBeInTheDocument();
    expect(screen.queryByText('0 of 0 completed')).toBeNull();
    expect(screen.getByTestId('goal-progress-track')).toBeInTheDocument();
    expect(screen.queryByTestId('goal-progress-fill')).toBeNull();
    expect(screen.getByTestId('goal-progress-ignored-segment')).toHaveStyle({
      flexGrow: '3',
    });
  });

  it('keeps an empty progress track when the goal has no steps', () => {
    useGoalStepSummariesMock.mockReturnValue(new Map());

    render(<GoalsSurface />);

    expect(screen.getByTestId('goal-progress-track')).toBeInTheDocument();
    expect(screen.queryByTestId('goal-progress-fill')).toBeNull();
    expect(screen.queryByTestId('goal-progress-ignored-segment')).toBeNull();
  });

  it('shows the ignored step count when no step is completed yet', () => {
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 0,
            itemCount: 4,
            ignoredCount: 2,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    expect(screen.getByText('0 of 4 completed')).toBeInTheDocument();
    expect(screen.getByText('2 ignored')).toBeInTheDocument();
  });

  it('splits progress between counted and ignored steps', () => {
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 3,
            itemCount: 5,
            ignoredCount: 5,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    const countedSegment = screen.getByTestId('goal-progress-counted-segment');
    const ignoredSegment = screen.getByTestId('goal-progress-ignored-segment');
    const track = screen.getByTestId('goal-progress-track');
    const fill = screen.getByTestId('goal-progress-fill');
    const badge = screen.getByText('3 of 5 completed');

    expect(badge).toHaveStyle({
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
    });
    expect(screen.getByText('5 ignored')).toBeInTheDocument();
    expect(countedSegment).toHaveStyle({ flexGrow: '5' });
    expect(ignoredSegment).toHaveStyle({ flexGrow: '5' });
    expect(fill).toHaveStyle({
      width: '60%',
    });
    expect(fill.style.backgroundColor).toBe(badge.style.backgroundColor);
    expect(track).toHaveStyle({
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
    });
    expect(ignoredSegment).toHaveStyle({
      backgroundColor: 'rgba(192, 199, 209, 0.46)',
    });
    expect(countedSegment.compareDocumentPosition(ignoredSegment)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps the goal progress bar when every step is complete', () => {
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 3,
            itemCount: 3,
            ignoredCount: 0,
            categoryTagIds: [],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    expect(screen.getByText('3 of 3 completed')).toBeInTheDocument();
    expect(screen.getByTestId('goal-progress-fill')).toHaveStyle({
      width: '100%',
    });
  });

  it('does not reserve card space for goal step category dots', () => {
    useGoalStepSummariesMock.mockReturnValue(
      new Map([
        [
          'goal-1',
          {
            completedCount: 1,
            itemCount: 2,
            ignoredCount: 0,
            categoryTagIds: ['step-category'],
            categorySummaries: new Map(),
          },
        ],
      ]),
    );

    render(<GoalsSurface />);

    const goalCard = screen.getByRole('button', { name: 'Focus' });

    expect(goalCard.querySelector('.size-3.rounded-full')).toBeNull();
  });

  it('renders active goals with a New goal action and no New group action', () => {
    render(<GoalsSurface />);

    expect(screen.getAllByRole('button', { name: 'New goal' })).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /new group/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Archived' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveClass(
      'cursor-pointer',
      'h-32',
    );
    expect(screen.getByRole('button', { name: 'New goal' })).toHaveClass(
      'h-32',
    );
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveClass('p-4');
    expect(screen.getByLabelText('Drag goal')).toHaveClass(
      'size-7',
      'rounded-full',
      'hover:bg-[#f0c38e]/14',
    );
    expect(screen.getByLabelText('Drag goal')).not.toHaveClass(
      'hover:bg-background',
    );
    expect(screen.getByText('Focus')).toHaveClass('text-base');
    expect(screen.getByText('2 of 3 completed')).toBeInTheDocument();
  });

  it('creates a real ungrouped goal from the primary action', async () => {
    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'New goal' }));

    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith({
        scope,
        groupId: null,
        title: 'New goal',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-new');
  });

  it('switches between active and archived goals from the overview toolbar', () => {
    render(<GoalsSurface />);

    const toolbar = screen.getByRole('toolbar', { name: 'Goals' });

    expect(
      within(toolbar).queryByRole('heading', { name: 'Goals' }),
    ).not.toBeInTheDocument();
    expect(toolbar.firstElementChild).toContainElement(
      within(toolbar).getByRole('button', { name: 'Active' }),
    );

    const activeButton = within(toolbar).getByRole('button', {
      name: 'Active',
    });
    const archivedButton = within(toolbar).getByRole('button', {
      name: 'Archived',
    });

    for (const button of [activeButton, archivedButton]) {
      expect(button).toHaveClass('rounded-full');
      expect(button.className).not.toContain('inset-ring');
    }
    expect(activeButton).toHaveClass('bg-[#f0c38e]');

    fireEvent.click(archivedButton);

    expect(
      within(screen.getByRole('toolbar', { name: 'Goals' })).getByRole(
        'button',
        { name: 'Archived' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText('There are no archived goals.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New goal' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole('toolbar', { name: 'Goals' })).getByRole(
        'button',
        { name: 'Active' },
      ),
    );

    expect(screen.getByRole('button', { name: 'New goal' })).toBeVisible();
  });

  it('opens the goal category manager from the overview toolbar', () => {
    render(<GoalsSurface />);

    fireEvent.click(
      within(screen.getByRole('toolbar', { name: 'Goals' })).getByRole(
        'button',
        { name: 'Categories' },
      ),
    );

    expect(
      screen.getByRole('dialog', { name: 'Edit goal categories' }),
    ).toHaveAttribute('data-surface', 'goal');
  });

  it('groups archived goals in flat sections and omits origin from cards', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) =>
      surface === 'goal_group'
        ? [
            {
              id: 'category-personal',
              name: 'Personal',
              colorHex: '#8b5cf6',
              position: '1',
              surface: 'goal_group',
            },
          ]
        : [],
    );
    useGoalGroupsMock.mockReturnValue([
      group({
        id: 'group-life',
        title: 'Life',
        sortRank: 'A',
        categoryTagId: 'category-personal',
      }),
      group({ id: 'group-work', title: 'Work', sortRank: 'B' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (!options.archived) return [];

      return [
        goal({
          id: 'goal-health',
          title: 'Health',
          groupId: 'group-life',
          completedAt: '2026-06-20T12:00:00.000Z',
        }),
        goal({
          id: 'goal-family',
          title: 'Family',
          groupId: 'group-life',
          completedAt: '2026-06-21T12:00:00.000Z',
        }),
        goal({
          id: 'goal-career',
          title: 'Career',
          groupId: 'group-work',
          completedAt: '2026-06-22T12:00:00.000Z',
        }),
        goal({
          id: 'goal-loose',
          title: 'Loose',
          groupId: null,
          completedAt: '2026-06-23T12:00:00.000Z',
        }),
      ];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));

    const lifeSection = screen.getByTestId('archived-goal-group-group-life');
    const workSection = screen.getByTestId('archived-goal-group-group-work');
    const noGroupSection = screen.getByTestId('archived-goal-group-none');
    const activeButton = screen.getByRole('button', { name: 'Active' });

    expect(lifeSection).not.toHaveClass(
      'inset-ring-hairline',
      'bg-white/[0.035]',
    );
    expect(within(lifeSection).getByText('Life')).toBeVisible();
    expect(within(lifeSection).getByText('Personal')).toBeVisible();
    expect(
      within(lifeSection).getByRole('button', { name: 'Health' }),
    ).toBeVisible();
    expect(
      within(lifeSection).getByRole('button', { name: 'Family' }),
    ).toBeVisible();
    expect(
      within(lifeSection).getByRole('button', { name: 'Health' }).parentElement,
    ).toHaveClass('lg:grid-cols-3', 'xl:grid-cols-4');
    expect(
      within(workSection).getByRole('button', { name: 'Career' }),
    ).toBeVisible();
    expect(
      within(noGroupSection).getByRole('button', { name: 'Loose' }),
    ).toBeVisible();
    expect(screen.queryByText(/Original group:/)).not.toBeInTheDocument();
    expect(
      screen
        .getAllByTestId(/^archived-goal-group-/)
        .map((section) => within(section).getByRole('heading').textContent),
    ).toEqual(['Life', 'Work', 'No group']);
    expect(
      lifeSection.compareDocumentPosition(activeButton) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).not.toBe(0);
  });

  it('uses the standard dropdown and allows deleting an archived goal', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) =>
      options.archived
        ? [
            goal({
              id: 'goal-archived',
              title: 'Done',
              completedAt: '2026-06-23T12:00:00.000Z',
            }),
          ]
        : [],
    );

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const menu = document.querySelector('[data-goal-actions-menu="true"]');
    const deleteButton = screen.getByRole('button', { name: 'Delete goal' });

    expect(menu).toHaveClass('modal-panel', 'modal-panel--flat');
    expect(deleteButton).toHaveClass('min-h-10', 'w-full', 'gap-3', 'px-3');

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(softDeleteGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
  });

  it('renders archived goal steps as read-only content', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [
          goal({
            id: 'goal-archived',
            title: 'Done',
            completedAt: '2026-06-23T12:00:00.000Z',
          }),
        ];
      }

      return [];
    });
    useGoalStepTreeMock.mockReturnValue([
      goalStep({
        goalId: 'goal-archived',
        text: 'Archived step',
        completed: true,
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText('Archived step')).toBeVisible();
    expect(screen.queryByDisplayValue('Archived step')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add step' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'More actions' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.queryByLabelText('Assign independent color'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign goal category' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear goal color/category' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore goal' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete goal' })).toBeVisible();
  });
});
