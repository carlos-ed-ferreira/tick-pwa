import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  IconButton,
  Input,
  Text,
  Tooltip,
} from '@/components/ui';

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
    );

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
      'border-[#f8d7aa]/70',
      'bg-[#f0c38e]',
      'text-[#312c51]',
    );
  });
});
