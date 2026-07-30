import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissAllToasts, toast, ToastViewport } from '@/components/ui/toast';

describe('toast notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissAllToasts();
  });

  afterEach(() => {
    cleanup();
    dismissAllToasts();
    vi.useRealTimers();
  });

  it('shows success and error feedback with accessible live regions', () => {
    render(<ToastViewport closeLabel="Dismiss notification" />);

    act(() => {
      toast.success('Tasks created.');
      toast.error('Enter a valid date.');
    });

    expect(screen.getByRole('status')).toHaveTextContent('Tasks created.');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid date.');
    expect(screen.getByRole('status')).toHaveClass('items-center', 'border-0');
    expect(screen.getByRole('status').className).not.toMatch(/\bring-/);
  });

  it('can be dismissed and disappears automatically', () => {
    render(<ToastViewport closeLabel="Dismiss notification" />);

    act(() => {
      toast.success('Saved.', { durationMs: 2_000 });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();

    act(() => {
      toast.error('Try again.', { durationMs: 2_000 });
    });
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.queryByText('Try again.')).not.toBeInTheDocument();
  });
});
