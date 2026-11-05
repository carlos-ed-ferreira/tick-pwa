import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormField, FormTextareaField } from '@/components/ui';

describe('FormField', () => {
  afterEach(() => {
    cleanup();
  });

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

  it('cuts the border notch without repeating the label text', () => {
    const { container } = render(<FormField label="Email" type="text" />);

    expect(screen.getAllByText('Email')).toHaveLength(1);
    expect(container.querySelector('fieldset')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('renders a trailing control inside the field', () => {
    render(
      <FormField
        endAdornment={<button type="button">Open calendar</button>}
        label="Start date"
        type="text"
      />,
    );

    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open calendar' }),
    ).toBeInTheDocument();
  });

  it('associates the floating label with a multiline field', () => {
    render(<FormTextareaField label="JSON" placeholder="{}" />);

    const textarea = screen.getByLabelText('JSON');

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('placeholder', '{}');
  });
});
