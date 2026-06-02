import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTreeSelection } from '@/hooks/use-tree-selection';

function SelectionHarness({ visibleIds }: { visibleIds: string[] }) {
  const selection = useTreeSelection(visibleIds);

  return (
    <div>
      <output data-testid="selected">
        {[...selection.selectedIds].join(',')}
      </output>
      <output data-testid="count">{selection.selectedCount}</output>
      <output data-testid="mode">{String(selection.isSelectionMode)}</output>
      {visibleIds.map((id) => (
        <button
          key={id}
          type="button"
          onClick={(event) => selection.toggleSelect(id, event.shiftKey)}
        >
          {id}
        </button>
      ))}
      <button type="button" onClick={selection.clearSelection}>
        clear
      </button>
    </div>
  );
}

describe('useTreeSelection', () => {
  afterEach(() => {
    cleanup();
  });

  it('toggles and clears selected ids', () => {
    render(<SelectionHarness visibleIds={['one', 'two']} />);

    expect(screen.getByTestId('mode')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: 'one' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('one');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('mode')).toHaveTextContent('true');

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('mode')).toHaveTextContent('false');
  });

  it('selects visible ranges with shift click', () => {
    render(<SelectionHarness visibleIds={['one', 'two', 'three']} />);

    fireEvent.click(screen.getByRole('button', { name: 'one' }));
    fireEvent.click(screen.getByRole('button', { name: 'three' }), {
      shiftKey: true,
    });

    expect(screen.getByTestId('selected')).toHaveTextContent('one,two,three');
    expect(screen.getByTestId('count')).toHaveTextContent('3');
  });

  it('prunes selected ids that are no longer visible', async () => {
    const { rerender } = render(
      <SelectionHarness visibleIds={['one', 'two']} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'one' }));
    rerender(<SelectionHarness visibleIds={['two']} />);

    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('');
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });
});
