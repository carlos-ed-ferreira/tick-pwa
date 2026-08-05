import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  DashedRing,
  Dialog,
  IconButton,
  Input,
  ModalActionButton,
  Text,
  Tooltip,
} from '@/components/ui';
import { fitDashedRingPathLength } from '@/components/ui/dashed-ring';

describe('UI primitives', () => {
  it('applies the Tick visual treatment to checkboxes', () => {
    render(<Checkbox aria-label="Complete task" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Complete task' });

    expect(checkbox).toHaveClass('tick-checkbox');
    expect(checkbox).toHaveClass('appearance-none');
    expect(checkbox).toHaveClass('focus-visible:outline-accent');
    expect(checkbox).toHaveClass('shadow-none');
  });

  it('applies structured input text assistance defaults', () => {
    render(<Input aria-label="Task title" />);

    const input = screen.getByLabelText('Task title');

    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'none');
  });

  it('allows input text assistance defaults to be overridden', () => {
    render(
      <Input
        aria-label="Long note"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
      />,
    );

    const input = screen.getByLabelText('Long note');

    expect(input).toHaveAttribute('spellcheck', 'true');
    expect(input).toHaveAttribute('autocorrect', 'on');
    expect(input).toHaveAttribute('autocapitalize', 'sentences');
  });

  it('renders text variants on the requested element', () => {
    render(
      <Text as="span" size="base" tone="muted" weight="semibold">
        Helper text
      </Text>,
    );

    const text = screen.getByText('Helper text');

    expect(text.tagName).toBe('SPAN');
    expect(text).toHaveClass('text-base', 'text-muted', 'font-semibold');
  });

  it('applies the shared button tone pattern by default', () => {
    render(<Button>Continue</Button>);

    const button = screen.getByRole('button', { name: 'Continue' });

    expect(button).toHaveClass('bg-secondary', 'text-primary-foreground');
    expect(button).not.toHaveClass('shadow-sm');
  });

  it('keeps modal surfaces borderless and modal actions compact', () => {
    render(
      <Dialog open title="Preferences" onClose={() => undefined}>
        <ModalActionButton tone="accent">
          <svg aria-hidden="true" />
          Save
        </ModalActionButton>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Preferences' });
    const action = screen.getByRole('button', { name: 'Save' });
    const closeButton = screen.getByRole('button', { name: 'Close' });

    expect(dialog).toHaveClass('border-0', 'after:hidden');
    expect(dialog.querySelector('.modal-header')).toHaveClass('border-0');
    expect(closeButton).toHaveClass('size-8');
    expect(closeButton).not.toHaveClass('size-9');
    expect(action).toHaveClass('h-8', 'rounded-full', 'px-3', 'text-sm');
    expect(action).toHaveClass('bg-[#f0c38e]', 'text-[#253241]');
    expect(action.querySelector('svg')).toBeInTheDocument();
  });

  it('draws dashed edges as a vector ring so the color survives the curves', () => {
    const { container } = render(<DashedRing radius={21.6} />);

    const svg = container.querySelector('svg');
    const rect = container.querySelector('rect');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('pointer-events-none', 'absolute');
    expect(rect).toHaveAttribute('rx', '21.6');
    expect(rect).toHaveAttribute('width', '100%');
    expect(rect).toHaveAttribute('height', '100%');
    expect(rect?.style.strokeWidth).toBe('var(--hairline)');
    expect(rect?.style.strokeDasharray).toBe('7 6');
    expect(rect?.style.stroke).toContain('--dashed-ring-color');
  });

  it.each([
    ['the independent-color circle', 2 * Math.PI * 10],
    ['a three-column goal card', 1054.92],
    ['a four-column goal card', 818],
  ])(
    'fits a complete dash pattern around %s without a shorter closing gap',
    (_, perimeter) => {
      const pathLength = fitDashedRingPathLength(perimeter);
      const scale = perimeter / pathLength;
      const dashLength = 7 * scale;
      const gapLength = 6 * scale;
      const cycleCount = pathLength / 13;

      expect(cycleCount).toBe(Math.round(cycleCount));
      expect(dashLength / gapLength).toBeCloseTo(7 / 6, 10);
      expect(gapLength).toBeGreaterThan(5);
    },
  );

  it('replaces native icon-button titles with the shared visual tooltip', () => {
    render(
      <IconButton aria-label="Configure preferences" title="Native title">
        <svg aria-hidden="true" />
      </IconButton>,
    );

    const button = screen.getByRole('button', {
      name: 'Configure preferences',
    });

    expect(button).not.toHaveAttribute('title');
    fireEvent.focus(button);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Native title');
    expect(screen.getByRole('tooltip')).toHaveClass('tick-tooltip');

    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('provides the same visual tooltip to native icon-only controls', () => {
    render(
      <Tooltip content="Change language">
        <button type="button" aria-label="Change language">
          <svg aria-hidden="true" />
        </button>
      </Tooltip>,
    );

    const button = screen.getByRole('button', { name: 'Change language' });
    fireEvent.focus(button);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Change language');
  });

  it('keeps danger styling reserved for destructive confirmation dialogs', () => {
    const noop = () => {};
    const { rerender } = render(
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        description="Delete this item?"
        open
        title="Delete item"
        onClose={noop}
        onConfirm={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'bg-rose-500/90',
      'text-rose-50',
      'shadow-rose-500/20',
      'h-8',
      'rounded-full',
    );
    expect(
      screen.getByRole('button', { name: 'Delete' }).querySelector('svg'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete' }).parentElement,
    ).toHaveClass('mt-4');
    const cancelAction = screen
      .getAllByRole('button', { name: 'Cancel' })
      .find((button) => button.textContent === 'Cancel');

    expect(cancelAction?.querySelector('svg')).toBeInTheDocument();

    rerender(
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Archive"
        confirmTone="primary"
        description="Archive this goal?"
        open
        title="Archive goal"
        onClose={noop}
        onConfirm={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Archive' })).toHaveClass(
      'inset-ring-[#f8d7aa]/70',
      'bg-[#f0c38e]',
      'text-[#253241]',
    );
  });
});
