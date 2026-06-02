import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedInlineEdit } from '@/hooks/use-debounced-inline-edit';

function InlineEditHarness({
  onSave,
  value,
}: {
  onSave: (value: string) => void;
  value: string;
}) {
  const edit = useDebouncedInlineEdit({ onSave, value });

  return (
    <input
      aria-label="Text"
      value={edit.text}
      onBlur={() => void edit.flush()}
      onChange={(event) => edit.setText(event.target.value)}
    />
  );
}

describe('useDebouncedInlineEdit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('saves changed text after the debounce delay', () => {
    const onSave = vi.fn();

    render(<InlineEditHarness value="Original" onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Text'), {
      target: { value: 'Edited' },
    });

    act(() => vi.advanceTimersByTime(499));

    expect(onSave).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

    expect(onSave).toHaveBeenCalledWith('Edited');
  });

  it('flushes immediately and clears the pending debounced save', () => {
    const onSave = vi.fn();

    render(<InlineEditHarness value="Original" onSave={onSave} />);

    const input = screen.getByLabelText('Text');
    fireEvent.change(input, { target: { value: 'Edited' } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Edited');

    act(() => vi.advanceTimersByTime(500));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('uses the latest source value when the parent value changes', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <InlineEditHarness value="Original" onSave={onSave} />,
    );

    fireEvent.change(screen.getByLabelText('Text'), {
      target: { value: 'Draft' },
    });
    rerender(<InlineEditHarness value="Remote" onSave={onSave} />);

    expect(screen.getByLabelText('Text')).toHaveValue('Remote');
  });
});
