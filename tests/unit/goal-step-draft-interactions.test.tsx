import {
  assignGoalStepCategoryMock,
  completeGoalMock,
  createGoalStepMock,
  goal,
  goalStep,
  routerPushMock,
  scope,
  updateGoalDueDateMock,
  updateGoalTitleMock,
  useCategoryTagsMock,
  useGoalStepTreeMock,
  useGoalsMock,
} from '../support/goals-surface-harness';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GoalsSurface } from '@/features/goals';
import { db } from '@/lib/db/database';

describe('GoalsSurface', () => {
  it('renders the selected goal category as a pill badge in the goal header', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          categoryTagId: 'category-1',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const categoryButton = screen.getByRole('button', {
      name: 'Assign goal category',
    });
    const categoryBadge = screen.getByText('Modo local').parentElement;

    expect(categoryButton).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'size-10',
      'rounded-md',
      'inset-ring-hairline',
      'inset-ring-white/10',
      'bg-white/5',
      'text-[#cbd5e0]',
    );
    expect(categoryButton.querySelector('.lucide-tag')).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear goal color/category',
    });
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    expect(categoryBadge).toHaveClass(
      'inline-flex',
      'min-h-10',
      'max-w-full',
      'rounded-full',
      'inset-ring-hairline',
      'px-3',
      'py-1',
      'text-sm',
      'font-medium',
      'text-[#f7e8ce]',
    );
    expect(categoryBadge).toHaveTextContent('Modo local');
    expect(categoryBadge?.querySelector('.rounded-full')).toBeNull();
    expect(categoryBadge).toHaveStyle({
      '--chip-edge': 'rgba(249, 115, 22, 0.6)',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
    });
  });

  it('renders the goal due date as a badge and updates it from the picker', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          dueDate: '2026-08-20',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(screen.getByText('Aug 20, 2026')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open date picker for Goal date' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'August 25, 2026' }));

    expect(updateGoalDueDateMock).toHaveBeenCalledWith({
      scope,
      goalId: 'goal-1',
      dueDate: '2026-08-25',
    });
  });

  it('clears the goal due date from the picker popover', () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          dueDate: '2026-08-20',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Open date picker for Goal date' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));

    expect(updateGoalDueDateMock).toHaveBeenCalledWith({
      scope,
      goalId: 'goal-1',
      dueDate: null,
    });
  });

  it('does not render a due date badge when the goal has no due date', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(
      screen.getByRole('button', { name: 'Open date picker for Goal date' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\w+ \d{1,2}, 2026/)).not.toBeInTheDocument();
  });

  describe('goal step date field visibility preference', () => {
    afterEach(async () => {
      await db.localPreferences.clear();
    });

    it('hides the goal step date field after toggling it off in the preferences dialog and keeps it hidden', async () => {
      useGoalStepTreeMock.mockReturnValue([goalStep()]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

      expect(
        screen.getByRole('button', { name: 'Open date picker for Step date' }),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );
      fireEvent.click(screen.getByRole('radio', { name: 'Step date: Hidden' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(
          screen.queryByRole('button', {
            name: 'Open date picker for Step date',
          }),
        ).not.toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );

      expect(
        screen.getByRole('radio', { name: 'Step date: Hidden' }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('goal step category tabs', () => {
    const focusTag = {
      id: 'focus',
      name: 'FOCUS',
      colorHex: '#2563eb',
      position: '1',
      surface: 'goal_step',
      useOwnName: false,
    };
    const homeTag = {
      id: 'home',
      name: 'HOME',
      colorHex: '#d97706',
      position: '2',
      surface: 'goal_step',
      useOwnName: false,
    };

    async function selectTabView() {
      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );
      fireEvent.click(
        screen.getByRole('radio', { name: 'Step view: Category tabs' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await screen.findByRole('tablist', { name: 'Step categories' });
    }

    beforeEach(async () => {
      await db.localPreferences.clear();
      useCategoryTagsMock.mockImplementation((_scope, surface) =>
        surface === 'goal_step' ? [focusTag, homeTag] : [],
      );
    });

    afterEach(async () => {
      await db.localPreferences.clear();
    });

    it('keeps a single list until the tab view is chosen in the preferences', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

      await selectTabView();

      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'All',
        'FOCUS',
        'No category',
      ]);
    });

    it('shows the whole subtree of the root steps in the selected tab', async () => {
      const child = goalStep({
        id: 'goal-step-1-1',
        text: 'Focus substep',
        parentId: 'goal-step-1',
        sortRank: 'i',
      });
      child.depth = 1;
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        child,
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();

      fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));

      expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Focus substep')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Loose step')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'No category' }));

      expect(screen.getByDisplayValue('Loose step')).toBeInTheDocument();
      expect(
        screen.queryByDisplayValue('Existing step'),
      ).not.toBeInTheDocument();
    });

    it('omits the uncategorized tab when every root step has a category', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({
          id: 'goal-step-2',
          text: 'Home step',
          categoryTagId: 'home',
          sortRank: 'j',
        }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();

      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'All',
        'FOCUS',
        'HOME',
      ]);
    });

    it('hides the tab strip while no root step has a category', async () => {
      useGoalStepTreeMock.mockReturnValue([goalStep()]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      fireEvent.click(
        screen.getByRole('button', { name: 'Configure step actions' }),
      );
      fireEvent.click(
        screen.getByRole('radio', { name: 'Step view: Category tabs' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Configure step actions' }),
        ).toBeInTheDocument();
      });

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('restores the tab view from the stored preference', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      const { unmount } = render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();
      unmount();

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

      expect(
        await screen.findByRole('tablist', { name: 'Step categories' }),
      ).toBeInTheDocument();
    });

    it('creates new root steps inside the active category tab', async () => {
      useGoalStepTreeMock.mockReturnValue([
        goalStep({ categoryTagId: 'focus' }),
        goalStep({ id: 'goal-step-2', text: 'Loose step', sortRank: 'j' }),
      ]);

      render(<GoalsSurface />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
      await selectTabView();

      fireEvent.click(screen.getByRole('tab', { name: 'FOCUS' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

      const draftInput = await waitFor(() => {
        const emptyInput = screen
          .getAllByPlaceholderText('Write a step')
          .find((input) => (input as HTMLTextAreaElement).value === '');

        expect(emptyInput).toBeDefined();
        return emptyInput as HTMLElement;
      });
      fireEvent.change(draftInput, { target: { value: 'New focus step' } });
      fireEvent.blur(draftInput);

      await waitFor(() => {
        expect(createGoalStepMock).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'New focus step' }),
        );
        expect(assignGoalStepCategoryMock).toHaveBeenCalledWith(
          expect.objectContaining({ categoryTagId: 'focus' }),
        );
      });
    });
  });

  it('keeps a date selected on a still-draft goal step visible and carries it over once persisted', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Start this goal by adding a step' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open date picker for Step date' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    const trigger = screen.getByRole('button', {
      name: 'Open date picker for Step date',
    });

    expect(trigger.textContent).toMatch(/^\d{2}\/\d{2}$/);
    const shortLabel = trigger.textContent;

    const input = screen.getByPlaceholderText('Write a step');
    fireEvent.change(input, { target: { value: 'Buy groceries' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Buy groceries',
          scheduledDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      );
    });

    expect(
      screen.getByRole('button', { name: 'Open date picker for Step date' }),
    ).toHaveTextContent(shortLabel as string);
  });

  it('renders the goal category as a color dot instead of a text badge when useOwnName is true', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal') {
        return [
          {
            id: 'category-1',
            name: '',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal',
            useOwnName: true,
          },
        ];
      }

      return [];
    });
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) {
        return [];
      }

      return [
        goal({
          id: 'goal-1',
          title: 'Focus',
          categoryTagId: 'category-1',
        }),
      ];
    });
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    const { container } = render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(screen.queryByText('Modo local')).not.toBeInTheDocument();

    const dot = Array.from(container.querySelectorAll('span')).find(
      (element) =>
        element.className.includes('inset-ring-white/30') &&
        element.className.includes('rounded-full'),
    );

    expect(dot).toBeDefined();
    expect(dot).toHaveStyle({ backgroundColor: '#f97316' });
  });

  it('uses an adaptive title width with only a max width in the goal header', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByLabelText('Rename goal');
    const wrapper = input.parentElement;

    expect(input).not.toHaveAttribute('placeholder');
    expect(input).not.toHaveClass('flex-1');
    expect(input).toHaveClass('absolute', 'inset-0', 'w-full', 'px-2');
    expect(wrapper).toHaveClass(
      'relative',
      'inline-block',
      'min-w-0',
      'shrink',
    );
    expect(wrapper).not.toHaveStyle({
      maxWidth: 'min(100%, 24rem)',
    });
  });

  it('does not persist an empty goal title and restores the previous title on blur', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByLabelText('Rename goal');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateGoalTitleMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Rename goal')).toHaveValue('Focus');
    });
  });

  it('asks for confirmation before archiving a goal from the detail header', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }));

    expect(screen.getByText('Archive this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive goal' })[1]);

    await waitFor(() => {
      expect(completeGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Archived' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
