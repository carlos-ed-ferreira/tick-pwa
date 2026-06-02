import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from '@/components/ui';

describe('FormField', () => {
  it('associates the floating label with the input and renders errors inline', () => {
    render(
      <FormField
        error="Enter a valid email address."
        label="Email"
        placeholder="you@example.com"
        type="text"
      />,
    );

    const input = screen.getByLabelText('Email');

    expect(input).toHaveAttribute('placeholder', 'you@example.com');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
  });
});
