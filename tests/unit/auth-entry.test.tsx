import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEntry } from '@/features/auth/auth-entry';

const { enterLocalModeMock, signInWithGoogleMock, signInWithPasswordMock } =
  vi.hoisted(() => ({
    enterLocalModeMock: vi.fn().mockResolvedValue(undefined),
    signInWithGoogleMock: vi.fn().mockResolvedValue(undefined),
    signInWithPasswordMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    authError: null,
    dictionary: {
      app: { name: 'Tick' },
      auth: {
        allowedOnly: 'Allowed only',
        emailInvalid: 'Enter a valid email address.',
        emailLabel: 'Email',
        emailPlaceholder: 'you@example.com',
        emailRequired: 'Enter your email.',
        localMode: 'Use local mode',
        localModeDescription: 'Local only',
        noSignup: 'No signup',
        orContinueWith: 'or continue with',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Your password',
        passwordRequired: 'Enter your password.',
        passwordSignInDescription: 'Use password',
        prototypeNotice: 'Private prototype',
        signInDescription: 'Use Google',
        signInUnavailable: 'Login unavailable',
        signInWithGoogle: 'Continue with Google',
        signInWithPassword: 'Continue with email',
        signingIn: 'Opening login...',
        signingInWithPassword: 'Signing in...',
        subtitle: 'Subtitle',
        title: 'Title',
      },
    },
    enterLocalMode: enterLocalModeMock,
    isLoginConfigured: true,
    signInWithGoogle: signInWithGoogleMock,
    signInWithPassword: signInWithPasswordMock,
  }),
}));

describe('AuthEntry', () => {
  beforeEach(() => {
    enterLocalModeMock.mockClear();
    signInWithGoogleMock.mockClear();
    signInWithPasswordMock.mockClear();
  });

  it('disables native form validation and renders local validation feedback', async () => {
    render(<AuthEntry />);

    const form = screen
      .getByRole('button', {
        name: 'Continue with email',
      })
      .closest('form');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    expect(form).toHaveAttribute('novalidate');
    expect(emailInput).toHaveAttribute('type', 'text');
    expect(emailInput).toHaveAttribute('spellcheck', 'false');
    expect(emailInput).toHaveAttribute('autocorrect', 'off');
    expect(emailInput).toHaveAttribute('autocapitalize', 'none');
    expect(passwordInput).toHaveAttribute('spellcheck', 'false');
    expect(passwordInput).toHaveAttribute('autocorrect', 'off');
    expect(passwordInput).toHaveAttribute('autocapitalize', 'none');

    fireEvent.submit(form!);

    expect(await screen.findByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('blocks invalid email locally before calling sign-in', async () => {
    render(<AuthEntry />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'invalid-email' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with email' }),
    );

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('submits normalized credentials after local validation passes', async () => {
    render(<AuthEntry />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '  user@example.com  ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with email' }),
    );

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith(
        'user@example.com',
        'secret',
      );
    });
  });
});
