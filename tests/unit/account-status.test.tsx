import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountStatus } from '@/features/auth/account-status';

const {
  openAuthEntryMock,
  retryAccountSyncMock,
  useAccountSyncStatusMock,
  useAppContextMock,
} = vi.hoisted(() => ({
  openAuthEntryMock: vi.fn().mockResolvedValue(undefined),
  retryAccountSyncMock: vi.fn().mockResolvedValue(undefined),
  useAccountSyncStatusMock: vi.fn(),
  useAppContextMock: vi.fn(),
}));

vi.mock('@/providers', () => ({
  useAppContext: useAppContextMock,
}));

vi.mock('@/features/auth/use-account-sync-status', () => ({
  useAccountSyncStatus: useAccountSyncStatusMock,
}));

describe('AccountStatus', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    openAuthEntryMock.mockClear();
    retryAccountSyncMock.mockClear();
    useAccountSyncStatusMock.mockReturnValue({
      retry: retryAccountSyncMock,
      summary: {
        state: 'saved',
        failedCount: 0,
        pendingCount: 0,
        syncingCount: 0,
      },
    });
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
        sync: {
          failed: 'Sync failed',
          pending: 'Saved locally, waiting to send',
          retry: 'Try again',
          retrying: 'Trying again',
          saved: 'Synced',
          syncing: 'Syncing',
        },
      },
      openAuthEntry: openAuthEntryMock,
      scope: { id: 'guest:local', kind: 'guest', ownerId: 'local' },
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
        sync: {
          failed: 'Sync failed',
          pending: 'Saved locally, waiting to send',
          retry: 'Try again',
          retrying: 'Trying again',
          saved: 'Synced',
          syncing: 'Syncing',
        },
      },
      openAuthEntry: openAuthEntryMock,
      scope: {
        id: 'user:authenticated-user',
        kind: 'user',
        ownerId: 'authenticated-user',
      },
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

  it('shows a failed sync and lets the user retry it', () => {
    useAccountSyncStatusMock.mockReturnValue({
      retry: retryAccountSyncMock,
      summary: {
        state: 'failed',
        failedCount: 2,
        pendingCount: 0,
        syncingCount: 0,
      },
    });
    useAppContextMock.mockReturnValue({
      authMode: 'authenticated',
      authUser: { email: 'user@example.com' },
      dictionary: {
        auth: {
          cloudModeBadge: 'Cloud mode',
          localModeBadge: 'Local mode',
          signInWithPassword: 'Sign in',
          signOut: 'Sign out',
        },
        sync: {
          failed: 'Sync failed',
          pending: 'Saved locally, waiting to send',
          retry: 'Try again',
          retrying: 'Trying again',
          saved: 'Synced',
          syncing: 'Syncing',
        },
      },
      openAuthEntry: openAuthEntryMock,
      scope: {
        id: 'user:authenticated-user',
        kind: 'user',
        ownerId: 'authenticated-user',
      },
      signOut: vi.fn(),
    });

    render(<AccountStatus />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Sync failed. Try again' }),
    );

    expect(retryAccountSyncMock).toHaveBeenCalledOnce();
  });
});
