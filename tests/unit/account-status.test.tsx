import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountStatus } from '@/features/auth/account-status';

const { openAuthEntryMock } = vi.hoisted(() => ({
  openAuthEntryMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    authMode: 'guest',
    authUser: null,
    dictionary: {
      auth: {
        cloudModeBadge: 'Cloud mode',
        localModeBadge: 'Local mode',
        signInWithPassword: 'Sign in',
        signOut: 'Sign out',
      },
    },
    openAuthEntry: openAuthEntryMock,
    signOut: vi.fn(),
  }),
}));

describe('AccountStatus', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    openAuthEntryMock.mockClear();
  });

  it('keeps the guest sign-in action enabled even when login is not configured', () => {
    render(<AccountStatus />);

    const signInButton = screen.getByRole('button', { name: 'Sign in' });

    expect(screen.getByText('Local mode')).toBeInTheDocument();
    expect(signInButton).toBeEnabled();

    fireEvent.click(signInButton);

    expect(openAuthEntryMock).toHaveBeenCalledOnce();
  });
});
