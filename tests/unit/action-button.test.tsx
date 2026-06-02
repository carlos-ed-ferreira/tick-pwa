import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionButton } from '@/components/ui';

describe('ActionButton', () => {
  it('keeps the description hidden until hover and does not render the arrow', () => {
    const { container } = render(
      <ActionButton
        description="Use a permitted account to keep cloud sync enabled."
        label="Continue with Google"
      />,
    );

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    const description = screen.getByText(
      'Use a permitted account to keep cloud sync enabled.',
    );
    const descriptionContainer = description.closest('p');

    expect(button).toHaveAttribute('aria-describedby');
    expect(descriptionContainer).toHaveClass(
      'max-h-0',
      'opacity-0',
      'group-hover:opacity-100',
    );
    expect(container.textContent).not.toContain('→');
  });
});
