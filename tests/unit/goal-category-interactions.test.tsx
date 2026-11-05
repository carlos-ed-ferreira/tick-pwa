import {
  assignGoalCategoryMock,
  createCategoryTagMock,
  createGoalStepMock,
  goal,
  goalStep,
  group,
  routerPushMock,
  scope,
  softDeleteGoalGroupMock,
  updateGoalStepTextMock,
  useCategoryTagsMock,
  useGoalGroupsMock,
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
import { describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';

describe('GoalsSurface', () => {
  it('renders goal actions in a portal, shows remove from group for grouped goals, omits new group and closes on outside click', async () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Focus', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: /LifeFocus/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const completeButton = screen.getByRole('button', {
      name: 'Archive goal',
    });

    expect(
      completeButton.closest('[data-goal-actions-menu="true"]'),
    ).toHaveClass('modal-panel--flat');
    expect(completeButton.closest('article')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'New group' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'NOVO GRUPO' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'No group' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove from group' }),
    ).toHaveClass('hover:bg-white/[0.08]');

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Archive goal' }),
      ).not.toBeInTheDocument();
    });
  });

  it('opens goal categories to the right on hover and assigns a named category', async () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) => {
      if (surface === 'goal') {
        return [
          {
            id: 'category-1',
            name: 'Modo local',
            colorHex: '#f97316',
            position: '1',
            surface: 'goal',
          },
          {
            id: 'category-own',
            name: 'Cor independente',
            colorHex: '#2563eb',
            position: '2',
            surface: 'goal',
            useOwnName: true,
          },
        ];
      }

      if (surface === 'goalGroup') {
        return [
          {
            id: 'group-category',
            name: 'Categoria de grupo',
            colorHex: '#16a34a',
            position: '1',
            surface: 'goalGroup',
          },
        ];
      }

      return [];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const colorInput = screen.getByLabelText('Assign independent color');
    const categoryButton = screen.getByRole('button', {
      name: 'Assign category',
    });
    vi.spyOn(categoryButton, 'getBoundingClientRect').mockReturnValue({
      bottom: 140,
      height: 40,
      left: 100,
      right: 300,
      top: 100,
      width: 200,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    const actionsMenu = categoryButton.closest(
      '[data-goal-actions-menu="true"]',
    );
    vi.spyOn(actionsMenu!, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 280,
      left: 80,
      right: 308,
      top: 20,
      width: 228,
      x: 80,
      y: 20,
      toJSON: () => ({}),
    });

    expect(screen.queryByRole('button', { name: 'Modo local' })).toBeNull();
    expect(
      colorInput.closest('label')?.compareDocumentPosition(categoryButton),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.mouseEnter(categoryButton);

    const categoryOption = screen.getByRole('button', { name: 'Modo local' });
    const extension = categoryOption.closest('.modal-panel');

    expect(categoryOption).toBeVisible();
    expect(extension).toHaveClass(
      'dropdown-extension-panel',
      'rounded-l-none',
      'modal-panel--flat',
      'z-50',
    );
    expect(extension).not.toHaveClass('z-70');
    expect(actionsMenu).toHaveClass('dropdown-joined-main');
    expect(categoryOption).not.toHaveClass('bg-white/[0.06]');
    expect(extension).not.toHaveClass('-translate-y-1/2');
    expect(extension).toHaveStyle({
      left: '307px',
      top: '120px',
      transform: 'translateY(-50%)',
    });
    expect(screen.queryByText('Cor independente')).toBeNull();
    expect(screen.queryByText('Categoria de grupo')).toBeNull();

    fireEvent.click(categoryButton);
    expect(categoryOption).toBeVisible();

    fireEvent.mouseLeave(categoryButton, { relatedTarget: extension });
    expect(categoryOption).toBeVisible();

    fireEvent.mouseEnter(extension!, { relatedTarget: categoryButton });
    fireEvent.mouseLeave(extension!, { relatedTarget: document.body });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Modo local' })).toBeNull();
    });

    fireEvent.mouseEnter(categoryButton);
    fireEvent.click(screen.getByRole('button', { name: 'Modo local' }));

    await waitFor(() => {
      expect(assignGoalCategoryMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        categoryTagId: 'category-1',
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete goal' }),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the card menu open while choosing an own-name color and closes it when the color picker closes', async () => {
    createCategoryTagMock.mockResolvedValue({ id: 'category-own' });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    const colorInput = screen.getByLabelText('Assign independent color');
    fireEvent.click(colorInput);

    fireEvent.input(colorInput, {
      target: { value: '#ff0000' },
    });

    await waitFor(() => {
      expect(createCategoryTagMock).toHaveBeenCalledWith({
        scope,
        surface: 'goal',
        name: '',
        colorHex: '#ff0000',
        useOwnName: true,
      });
      expect(assignGoalCategoryMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        categoryTagId: 'category-own',
      });
    });

    expect(screen.getByRole('button', { name: 'Delete goal' })).toBeVisible();

    fireEvent.change(colorInput);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete goal' }),
      ).not.toBeInTheDocument();
    });
  });

  it('clears the assigned category from a dedicated card menu action', async () => {
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [
        goal({ id: 'goal-1', title: 'Focus', categoryTagId: 'category-1' }),
      ];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    expect(
      screen
        .getByRole('button', { name: 'Assign category' })
        .querySelector('.lucide-tag'),
    ).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear goal color/category',
    });
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    fireEvent.click(clearCategoryButton);

    await waitFor(() => {
      expect(assignGoalCategoryMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        categoryTagId: null,
      });
    });
  });

  it('labels the group destination section as moving the goal to a group', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    expect(screen.getByText('Move to')).toBeVisible();
  });

  it('renders the delete action with a clearly visible red tone in the card menu', () => {
    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));

    expect(screen.getByRole('button', { name: 'Delete goal' })).toHaveClass(
      'text-rose-300',
    );
  });

  it('opens a group and then opens a goal inside that group', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));
    expect(routerPushMock).toHaveBeenCalledWith('/goals?group=group-1');

    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-1');
  });

  it('renders the group detail header using the same input and back-button pattern as goal detail', () => {
    useCategoryTagsMock.mockImplementation((_scope, surface) =>
      surface === 'goal_group'
        ? [
            {
              id: 'group-category',
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
        id: 'group-1',
        title: 'Life',
        categoryTagId: 'group-category',
      }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));

    const backButton = screen.getByRole('button', { name: 'Back' });
    const titleInput = screen.getByLabelText('Rename group');
    const categoryButton = screen.getByRole('button', {
      name: 'Assign group category',
    });

    expect(backButton).toHaveClass('h-10', 'rounded-full', 'bg-white/8');
    expect(titleInput).toHaveValue('Life');
    expect(titleInput).not.toHaveAttribute('placeholder');
    expect(titleInput).toHaveClass(
      'absolute',
      'inset-0',
      'h-full',
      'w-full',
      'px-2',
      'py-1',
      'text-2xl',
      'font-semibold',
    );
    expect(titleInput.parentElement).toHaveClass(
      'relative',
      'inline-block',
      'min-w-0',
      'max-w-full',
      'shrink',
      'align-middle',
    );
    expect(categoryButton).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'size-10',
      'rounded-full',
      'bg-white/8',
      'text-[#f8f3ea]',
    );
    expect(categoryButton.querySelector('.lucide-tag')).not.toBeNull();
    const clearCategoryButton = screen.getByRole('button', {
      name: 'Clear group color/category',
    });
    expect(
      clearCategoryButton.querySelector('[data-clear-category-icon]'),
    ).not.toBeNull();
    expect(clearCategoryButton.querySelector('.lucide-x')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Delete group' }),
    ).toBeInTheDocument();
  });

  it('deletes a group from its detail and returns goals to the ungrouped list', async () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));

    expect(screen.getByText('Delete this group?')).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete group' }).at(-1)!,
    );

    await waitFor(() => {
      expect(softDeleteGoalGroupMock).toHaveBeenCalledWith({
        scope,
        goalGroupId: 'group-1',
      });
      expect(routerPushMock).toHaveBeenCalledWith('/goals');
    });
  });

  it('shows a tooltip on the independent group color selector', async () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));
    fireEvent.focus(screen.getByLabelText('Assign independent color'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Assign independent color',
    );
  });

  it('renders group goals without an extra wrapper card and adds New goal as a tile', () => {
    useGoalGroupsMock.mockReturnValue([
      group({ id: 'group-1', title: 'Life' }),
    ]);
    useGoalsMock.mockImplementation((_scope, options = {}) => {
      if (options.archived) return [];

      return [goal({ id: 'goal-1', title: 'Health', groupId: 'group-1' })];
    });

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: /LifeHealth/i }));

    const newGoalCard = screen.getByRole('button', { name: 'New goal' });
    const goalCard = screen.getByRole('button', { name: 'Health' });

    expect(goalCard).toHaveClass('h-32');
    expect(newGoalCard).toHaveClass(
      'h-32',
      'justify-center',
      'rounded-[1.35rem]',
    );
    expect(newGoalCard.querySelector('rect')?.style.strokeDasharray).toBe(
      '7 6',
    );
    expect(
      screen.queryByRole('heading', { name: 'Life' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('This group has no goals yet. Create the first goal.'),
    ).not.toBeInTheDocument();
  });

  it('opens a goal detail preserving the goal step surface', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    expect(routerPushMock).toHaveBeenCalledWith('/goals?goal=goal-1');
    expect(screen.getByLabelText('Rename goal')).toHaveValue('Focus');
    expect(screen.getByDisplayValue('Existing step')).toBeInTheDocument();
  });

  it('keeps selection disabled on goal steps that are still drafts', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByDisplayValue('Existing step');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });

    const draftRow = screen
      .getAllByPlaceholderText('Write a step')[1]
      .closest('[data-tree-row]');

    expect(
      within(draftRow as HTMLElement).getByLabelText('Select step'),
    ).toBeDisabled();
  });

  it('creates a local goal step draft after flushing the edited row', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const input = screen.getByDisplayValue('Existing step');
    fireEvent.change(input, { target: { value: 'Edited step' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(updateGoalStepTextMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
        text: 'Edited step',
      });
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
  });
});
