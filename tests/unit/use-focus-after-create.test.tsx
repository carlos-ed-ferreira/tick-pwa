import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';

function FocusHarness() {
  const focusAfterCreate = useFocusAfterCreate();

  return (
    <div>
      <button type="button" onClick={() => focusAfterCreate('next')}>
        Focus next
      </button>
      <input data-item-id="next" aria-label="Next input" />
    </div>
  );
}

describe('useFocusAfterCreate', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    cleanup();
    window.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('focuses an input by the created item id', () => {
    render(<FocusHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Focus next' }));

    expect(screen.getByLabelText('Next input')).toHaveFocus();
  });
});
