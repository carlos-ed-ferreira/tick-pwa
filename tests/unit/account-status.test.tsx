import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSyncIndicator } from '@/features/auth/account-sync-indicator';
import { AccountStatus } from '@/features/auth/account-status';
import type { Dictionary } from '@/lib/i18n';

const syncDictionary: Dictionary['sync'] = {
  failed: 'Sync failed',
  pending: 'Saved locally, waiting to send',
  retry: 'Try again',
  retrying: 'Trying again',
  force: 'Sync now',
  forcing: 'Syncing now',
  saved: 'Synced',
  syncing: 'Syncing',
};

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
        sync: syncDictionary,
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
    expect(signInButton).toHaveClass('rounded-full');
    expect(signInButton.className).not.toContain('inset-ring');

    fireEvent.click(signInButton);

    expect(openAuthEntryMock).toHaveBeenCalledOnce();
  });

  it('renders sign out as a round icon button that names the account in its tooltip', async () => {
    const signOutMock = vi.fn();

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
        sync: syncDictionary,
      },
      openAuthEntry: openAuthEntryMock,
      scope: {
        id: 'user:authenticated-user',
        kind: 'user',
        ownerId: 'authenticated-user',
      },
      signOut: signOutMock,
    });

    render(<AccountStatus />);

    const signOutButton = screen.getByRole('button', { name: 'Sign out' });

    expect(signOutButton).toHaveTextContent('');
    expect(signOutButton).toHaveClass('rounded-full', 'size-10');
    expect(signOutButton.className).not.toContain('inset-ring');
    expect(signOutButton).not.toHaveAttribute('title');

    fireEvent.mouseEnter(signOutButton.parentElement as HTMLElement);

    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip).toHaveTextContent('Sign out');
    expect(tooltip).toHaveTextContent('a-very-long-email-address@example.com');

    fireEvent.click(signOutButton);

    expect(signOutMock).toHaveBeenCalledOnce();
  });

  it('renders the sync control as a round icon button that exposes its status in a tooltip', async () => {
    useAccountSyncStatusMock.mockReturnValue({
      retry: retryAccountSyncMock,
      summary: {
        state: 'saved',
        failedCount: 0,
        pendingCount: 0,
        syncingCount: 0,
      },
    });

    render(
      <AccountSyncIndicator
        dictionary={syncDictionary}
        scope={{
          id: 'user:authenticated-user',
          kind: 'user',
          ownerId: 'authenticated-user',
        }}
      />,
    );

    const syncButton = screen.getByRole('button', {
      name: 'Synced. Sync now',
    });

    expect(syncButton).toHaveTextContent('');
    expect(syncButton).toHaveClass('rounded-full', 'size-10');
    expect(syncButton.className).not.toContain('inset-ring');
    expect(syncButton).toHaveClass(
      'hover:-translate-y-0.5',
      'hover:shadow-md',
      'active:translate-y-0',
    );

    fireEvent.mouseEnter(syncButton.parentElement as HTMLElement);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Synced');
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

    render(
      <AccountSyncIndicator
        dictionary={syncDictionary}
        scope={{
          id: 'user:authenticated-user',
          kind: 'user',
          ownerId: 'authenticated-user',
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Sync failed. Try again' }),
    );

    expect(retryAccountSyncMock).toHaveBeenCalledOnce();
  });
});
