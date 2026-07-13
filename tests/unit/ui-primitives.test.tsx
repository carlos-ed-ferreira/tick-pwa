import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  Input,
  Text,
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
      'border-rose-300/24',
      'bg-rose-400/15',
      'text-rose-50',
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
      'bg-primary',
      'text-primary-foreground',
      'shadow-[0_14px_28px_rgba(59,130,246,0.18)]',
    );
  });
});
