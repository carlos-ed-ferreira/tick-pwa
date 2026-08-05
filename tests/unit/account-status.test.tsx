import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountStatus } from '@/features/auth/account-status';

const { openAuthEntryMock, useAppContextMock } = vi.hoisted(() => ({
  openAuthEntryMock: vi.fn().mockResolvedValue(undefined),
  useAppContextMock: vi.fn(),
}));

vi.mock('@/providers', () => ({
  useAppContext: useAppContextMock,
}));

describe('AccountStatus', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    openAuthEntryMock.mockClear();
    useAppContextMock.mockReturnValue({
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
    });
  });

  it('keeps the guest sign-in action enabled even when login is not configured', () => {
    render(<AccountStatus />);

    const signInButton = screen.getByRole('button', { name: 'Sign in' });

    expect(screen.getByText('Local mode')).toBeInTheDocument();
    expect(signInButton).toBeEnabled();

    fireEvent.click(signInButton);

    expect(openAuthEntryMock).toHaveBeenCalledOnce();
  });

  it('shows the complete authenticated email in the project tooltip', async () => {
    useAppContextMock.mockReturnValue({
      authMode: 'authenticated',
      authUser: { email: 'a-very-long-email-address@example.com' },
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
    });

    render(<AccountStatus />);

    const email = screen.getByText('a-very-long-email-address@example.com');

    expect(email).toHaveClass('truncate');
    expect(email.parentElement).not.toHaveAttribute('title');

    const tooltipTrigger = email.parentElement?.parentElement;

    expect(tooltipTrigger).not.toBeNull();
    fireEvent.mouseEnter(tooltipTrigger as HTMLElement);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'a-very-long-email-address@example.com',
    );
  });
});
