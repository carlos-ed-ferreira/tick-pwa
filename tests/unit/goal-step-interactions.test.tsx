import {
  completeGoalMock,
  createGoalStepMock,
  goal,
  goalStep,
  reopenGoalMock,
  routerPushMock,
  scope,
  setGoalStepsCompletedMock,
  softDeleteGoalStepMock,
  toggleGoalStepCollapsedMock,
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
import { setScopedPreference } from '@/lib/db/scoped-preferences';

describe('GoalsSurface', () => {
  it('persists a goal step draft without removing it from the screen', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.keyDown(screen.getByDisplayValue('Existing step'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a step')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft step' } });
    fireEvent.blur(draftInput);

    await waitFor(() => {
      expect(createGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-1',
        id: expect.any(String),
        parentId: null,
        afterGoalStepId: 'goal-step-1',
        bold: false,
        scheduledDate: null,
        text: 'Draft step',
      });
    });
    expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    expect(draftInput).toBeInTheDocument();
  });

  it('allows creating multiple empty root goal step drafts without saving them', async () => {
    useGoalStepTreeMock.mockReturnValue([]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start this goal by adding a step',
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
  });

  it('indents and outdents an empty goal step draft locally', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.keyDown(screen.getByDisplayValue('Existing step'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(2);
    });
    const draftInput = screen.getAllByPlaceholderText('Write a step')[1];
    const draftRow = draftInput.closest('[data-tree-row]');

    expect(draftRow).not.toBeNull();

    fireEvent.click(
      within(draftRow as HTMLElement).getByLabelText('Make substep'),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '14px',
      });
    });

    const indentedRow = draftInput.closest('[data-tree-row]');
    fireEvent.click(
      within(indentedRow as HTMLElement).getByLabelText(
        'Promote step one level',
      ),
    );

    await waitFor(() => {
      expect(draftInput.closest('[data-tree-row]')).toHaveStyle({
        paddingLeft: '0px',
      });
    });
    expect(createGoalStepMock).not.toHaveBeenCalled();
  });

  it('hides a deleted goal step while the local delete is still pending', async () => {
    let resolveDelete!: () => void;
    softDeleteGoalStepMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    const stepRow = screen
      .getByDisplayValue('Existing step')
      .closest('[data-tree-row]');

    fireEvent.click(
      within(stepRow as HTMLElement).getByLabelText('More actions'),
    );
    fireEvent.click(screen.getByLabelText('Delete step'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue('Existing step'),
      ).not.toBeInTheDocument();
    });

    resolveDelete();
  });

  it('keeps a goal-step parent visible while optimistically collapsing children', async () => {
    let resolveCollapse!: () => void;
    toggleGoalStepCollapsedMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCollapse = resolve;
      }),
    );
    const parent = goalStep({ text: 'Parent step' });
    parent.childCount = 1;
    parent.hasChildren = true;
    const child = goalStep({
      id: 'goal-step-child',
      parentId: 'goal-step-1',
      text: 'Child step',
    });
    child.depth = 1;
    useGoalStepTreeMock.mockReturnValue([parent, child]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(
      screen
        .getAllByLabelText('Collapse step')
        .find((button) => !button.hasAttribute('disabled'))!,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Parent step')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Child step')).not.toBeInTheDocument();
    });

    resolveCollapse();
  });

  it('bulk toggles selected goal steps from the checkbox', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep(),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getAllByLabelText('Select step')[0]);
    fireEvent.click(screen.getByLabelText('Select step'));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1', 'goal-step-2'],
        completed: true,
        ignored: false,
        markLevel: 1,
      });
    });
  });

  it('bulk clears selected completed goal steps with the default marking states', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep({ completed: true }),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getAllByLabelText('Select step')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1'],
        completed: false,
        ignored: false,
        markLevel: 0,
      });
    });
  });

  it('bulk completes selected goal steps from the collective action', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep(),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    const selectionButtons = screen.getAllByLabelText('Select step');
    fireEvent.click(selectionButtons[0]);
    fireEvent.click(selectionButtons[1]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark · 2 steps selected' }),
    );

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1', 'goal-step-2'],
        completed: true,
        ignored: false,
        markLevel: 1,
      });
    });
  });

  it('advances the collective completion action of goal steps to the next configured marking level', async () => {
    await setScopedPreference({
      key: 'goalStepCompletionStates',
      scope,
      value: { ignored: false, levels: 2 },
    });
    useGoalStepTreeMock.mockReturnValue([
      goalStep({ completed: true }),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        completed: true,
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute(
        'data-mark-level',
        '1',
      );
    });
    const selectionButtons = screen.getAllByLabelText('Select step');
    fireEvent.click(selectionButtons[0]);
    fireEvent.click(selectionButtons[1]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark · 2 steps selected' }),
    );

    await waitFor(() => {
      expect(setGoalStepsCompletedMock).toHaveBeenCalledWith({
        scope,
        goalStepIds: ['goal-step-1', 'goal-step-2'],
        completed: true,
        ignored: false,
        markLevel: 2,
      });
    });
  });

  it('removes local sibling drafts anchored to a bulk-deleted goal step', async () => {
    useGoalStepTreeMock.mockReturnValue([
      goalStep(),
      goalStep({
        id: 'goal-step-2',
        text: 'Second step',
        sortRank: 'j',
      }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.keyDown(screen.getByDisplayValue('Existing step'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Write a step')).toHaveLength(3);
    });

    const draftInput = screen.getAllByPlaceholderText('Write a step')[1];
    fireEvent.change(draftInput, { target: { value: 'Draft fragment' } });
    fireEvent.click(screen.getAllByLabelText('Select step')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete · 1 step selected' }),
    );
    expect(
      await screen.findByText('You are about to delete 1 selected record.'),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
        scope,
        goalStepId: 'goal-step-1',
      });
    });

    expect(
      screen.queryByDisplayValue('Draft fragment'),
    ).not.toBeInTheDocument();
    const createdDraftId = createGoalStepMock.mock.calls[0]?.[0].id;
    expect(createdDraftId).toEqual(expect.any(String));
    expect(softDeleteGoalStepMock).toHaveBeenCalledWith({
      scope,
      goalStepId: createdDraftId,
    });
  });

  it('asks for confirmation before restoring an archived goal from the card menu', async () => {
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

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore goal' }));

    expect(screen.getByText('Restore this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore goal' }));

    await waitFor(() => {
      expect(reopenGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('asks for confirmation before archiving a goal from the card menu', async () => {
    render(<GoalsSurface />);

    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }));

    expect(screen.getAllByText('Archive goal')).toHaveLength(2);
    expect(screen.getByText('Archive this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }));

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

  it('renders the uncategorized goal trigger as an action box in the goal header', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const categoryButton = screen.getByRole('button', {
      name: 'Assign goal category',
    });

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
    expect(categoryButton).not.toHaveTextContent('Modo local');
  });

  it('shows a tooltip on the independent goal color selector', async () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.focus(screen.getByLabelText('Assign independent color'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Assign independent color',
    );
  });

  it('keeps the independent color swatch click-through so the whole control opens the picker', () => {
    useGoalStepTreeMock.mockReturnValue([goalStep()]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));

    const colorInput = screen.getByLabelText('Assign independent color');
    const swatch = colorInput.parentElement?.querySelector(
      '[aria-hidden="true"]',
    );

    expect(swatch).toHaveClass('pointer-events-none');
  });
});
