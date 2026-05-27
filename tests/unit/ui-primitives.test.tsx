import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input, Text } from '@/components/ui';

describe('UI primitives', () => {
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
});
