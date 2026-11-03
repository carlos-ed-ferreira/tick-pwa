import {
  goal,
  goalStep,
  reopenGoalMock,
  routerPushMock,
  scope,
  useGoalStepTreeMock,
  useGoalsMock,
} from '../support/goals-surface-harness';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalsSurface } from '@/features/goals';
import { stubPointerCapability } from '../support/pointer';

describe('GoalsSurface', () => {
  it('asks for confirmation before restoring an archived goal from the detail header', async () => {
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
      goalStep({ goalId: 'goal-archived' }),
    ]);

    render(<GoalsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore goal' }));

    expect(screen.getByText('Restore this goal?')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Restore goal' })[1]);

    await waitFor(() => {
      expect(reopenGoalMock).toHaveBeenCalledWith({
        scope,
        goalId: 'goal-archived',
      });
    });
    expect(routerPushMock).toHaveBeenCalledWith('/goals');
    expect(screen.getByRole('button', { name: 'Archived' })).toBeVisible();
  });

  describe('on touch', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('collapses the goal detail actions into a sheet', () => {
      stubPointerCapability(true);
      window.history.replaceState({}, '', '/goals?goal=goal-1');

      render(<GoalsSurface />);

      expect(
        screen.queryByRole('button', { name: 'Archive goal' }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'More options' }));

      expect(
        screen.getByRole('button', { name: 'Archive goal' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Delete goal' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Assign goal category' }),
      ).toBeInTheDocument();
    });

    it('keeps the goal detail actions inline on a fine pointer', () => {
      stubPointerCapability(false);
      window.history.replaceState({}, '', '/goals?goal=goal-1');

      render(<GoalsSurface />);

      expect(
        screen.getByRole('button', { name: 'Archive goal' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'More options' }),
      ).not.toBeInTheDocument();
    });
  });
});
