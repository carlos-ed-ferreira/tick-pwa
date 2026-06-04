import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEntry } from '@/features/auth/auth-entry';

const { enterLocalModeMock, signInWithGoogleMock, signInWithPasswordMock } =
  vi.hoisted(() => ({
    enterLocalModeMock: vi.fn().mockResolvedValue(undefined),
    signInWithGoogleMock: vi.fn().mockResolvedValue(undefined),
    signInWithPasswordMock: vi
      .fn()
      .mockResolvedValue({ status: 'authenticated' }),
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
        localMode: 'Continue without syncing',
        localModeDescription: 'Your data will stay only on this device.',
        noSignup: 'No signup',
        orContinueWith: 'or continue with',
        passwordFormHint:
          'Sign in with your approved account to sync your data.',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Your password',
        passwordIncorrect: 'The password you entered is not correct.',
        passwordRequired: 'Enter your password.',
        passwordSignInDescription: 'Use password',
        prototypeNotice: 'Private prototype',
        signInDescription: 'Use Google',
        signInCheckingAccess:
          'Validating credentials and preparing your account...',
        signInFailed: 'Could not sign in right now. Try again.',
        signInUnavailable: 'Login unavailable',
        signInWithGoogle: 'Continue with Google',
        signInWithPassword: 'Sign in',
        signingIn: 'Opening login...',
        signingInWithPassword: 'Signing in...',
        subtitle: 'Subtitle',
        title: 'Title',
        emailNotAllowed: 'This email is not approved to use Tick yet.',
      },
      settings: { language: 'Language' },
    },
    enterLocalMode: enterLocalModeMock,
    isLoginConfigured: true,
    isReady: true,
    locale: 'en',
    signInWithGoogle: signInWithGoogleMock,
    signInWithPassword: signInWithPasswordMock,
    setLocale: vi.fn(),
  }),
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('AuthEntry', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    enterLocalModeMock.mockClear();
    signInWithGoogleMock.mockClear();
    signInWithPasswordMock.mockClear();
  });

  it('disables native form validation and renders local validation feedback', async () => {
    render(<AuthEntry />);

    const form = screen
      .getByRole('button', {
        name: 'Sign in',
      })
      .closest('form');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    expect(form).toHaveAttribute('novalidate');
    expect(
      screen.getByText('Sign in with your approved account to sync your data.'),
    ).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith(
        'user@example.com',
        'secret',
      );
    });
  });

  it('keeps the primary action in a loading state while password sign-in is pending', async () => {
    const deferred = createDeferred<{ status: 'invalid_credentials' }>();
    signInWithPasswordMock.mockReturnValueOnce(deferred.promise);

    render(<AuthEntry />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      screen.getByRole('button', { name: 'Signing in...' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Validating credentials and preparing your account...'),
    ).toBeInTheDocument();

    deferred.resolve({ status: 'invalid_credentials' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    });
  });

  it('shows a password error when credentials are rejected', async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      status: 'invalid_credentials',
    });

    render(<AuthEntry />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('The password you entered is not correct.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows an email error when the account is not approved', async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ status: 'not_allowed' });

    render(<AuthEntry />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'blocked@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('This email is not approved to use Tick yet.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
