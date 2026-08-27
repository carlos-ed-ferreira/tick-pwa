import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from '@/components/ui/tooltip';

function renderTooltip(onClick = vi.fn()) {
  render(
    <Tooltip content="Delete task">
      <button type="button" onClick={onClick}>
        Delete
      </button>
    </Tooltip>,
  );

  return { onClick, trigger: screen.getByRole('button', { name: 'Delete' }) };
}

function longPress(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { pointerType: 'touch' });
  act(() => {
    vi.advanceTimersByTime(400);
  });
  fireEvent.pointerUp(trigger, { pointerType: 'touch' });
  fireEvent.click(trigger, { pointerType: 'touch' });
}

describe('Tooltip on touch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('reveals the content on a long press', () => {
    const { trigger } = renderTooltip();

    expect(screen.queryByRole('tooltip')).toBeNull();

    longPress(trigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Delete task');
  });

  it('does not run the control action when the long press opened the tooltip', () => {
    const { onClick, trigger } = renderTooltip();

    longPress(trigger);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a short tap acting on the control without opening the tooltip', () => {
    const { onClick, trigger } = renderTooltip();

    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    fireEvent.pointerUp(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger, { pointerType: 'touch' });

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('closes on a tap outside the trigger', () => {
    const { trigger } = renderTooltip();

    longPress(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(document.body, { pointerType: 'touch' });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('still closes on a mouse press, keeping the desktop behaviour', () => {
    const { onClick, trigger } = renderTooltip();

    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    fireEvent.click(trigger, { pointerType: 'mouse' });

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
