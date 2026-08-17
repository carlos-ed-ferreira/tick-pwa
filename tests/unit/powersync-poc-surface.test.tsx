import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PowerSyncPocSurface } from '@/features/powersync-poc/powersync-poc-surface';
import { createUserScope } from '@/lib/domain';

const accountScope = createUserScope('account-user');

const {
  isAllowedMock,
  readSnapshotMock,
  readStatusMock,
  startMock,
  writeBatchMock,
} = vi.hoisted(() => ({
  isAllowedMock: vi.fn(() => false),
  readSnapshotMock: vi.fn().mockResolvedValue({
    categoryTags: [],
    checklistItems: [],
    dailyEntries: [],
  }),
  readStatusMock: vi.fn().mockResolvedValue({
    connected: true,
    connecting: false,
    downloading: false,
    hasError: false,
    hasSynced: true,
    lastSyncedAt: '2026-08-11T12:00:00.000Z',
    pendingOperations: 0,
    uploading: false,
  }),
  startMock: vi.fn().mockResolvedValue(undefined),
  writeBatchMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/environment', () => ({
  shouldUsePowerSyncPocForUser: isAllowedMock,
}));

vi.mock('@/lib/powersync/runtime', () => ({
  readPowerSyncPocSnapshot: readSnapshotMock,
  readPowerSyncPocStatus: readStatusMock,
  startPowerSyncPoc: startMock,
  writePowerSyncPocBatch: writeBatchMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    authMode: 'authenticated',
    dictionary: {
      powerSyncPoc: {
        categories: 'Local categories',
        categoryLabel: 'Proof category',
        childLabel: 'Subtask',
        siblingLabel: 'Second subtask',
        createScenario: 'Save local scenario',
        creating: 'Saving',
        description: 'Isolated proof',
        empty: 'No local scenario',
        error: 'Proof error',
        hierarchy: 'Local hierarchy',
        localNotice: 'Does not use Dexie',
        parentLabel: 'Main task',
        ready: 'SQLite ready',
        refresh: 'Refresh local data',
        required: 'Complete all fields',
        title: 'PowerSync proof',
        unavailable: 'Proof unavailable',
        itemLabel: 'Item text',
        itemAction: '{action}: {item}',
        saveItem: 'Save text',
        markComplete: 'Complete',
        reopenItem: 'Reopen',
        moveDown: 'Move down',
        deleteItem: 'Delete',
        deleteTitle: 'Delete proof item',
        confirmDelete: 'Confirm proof deletion',
        connected: 'Connected',
        connecting: 'Connecting',
        offline: 'Offline',
        synchronized: 'Queue synchronized',
        pendingOperation: '{count} operation waiting',
        pendingOperations: '{count} operations waiting',
        mutationError: 'Mutation error',
      },
      auth: { loading: 'Loading' },
      actions: { cancel: 'Cancel', delete: 'Delete' },
      sync: { syncing: 'Syncing' },
    },
    scope: accountScope,
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

describe('PowerSyncPocSurface', () => {
  afterEach(() => {
    cleanup();
    isAllowedMock.mockReset();
    isAllowedMock.mockReturnValue(false);
    readSnapshotMock.mockClear();
    readStatusMock.mockClear();
    startMock.mockClear();
    writeBatchMock.mockClear();
  });

  it('does not expose proof controls to an account outside the rollout', () => {
    render(<PowerSyncPocSurface />);

    expect(screen.getByText('Proof unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('writes the isolated scenario through the PowerSync batch', async () => {
    isAllowedMock.mockReturnValue(true);
    render(<PowerSyncPocSurface />);

    await screen.findByText('SQLite ready');
    const action = screen.getByRole('button', { name: 'Save local scenario' });
    const form = action.closest('form');

    expect(form).toHaveAttribute('novalidate');
    fireEvent.click(action);

    await waitFor(() => {
      expect(writeBatchMock).toHaveBeenCalledOnce();
    });
    expect(
      writeBatchMock.mock.calls[0][0].map(
        (change: { entityType: string }) => change.entityType,
      ),
    ).toEqual([
      'categoryTag',
      'dailyEntry',
      'checklistItem',
      'checklistItem',
      'checklistItem',
    ]);
  });

  it('shows the redacted upload queue state', async () => {
    isAllowedMock.mockReturnValue(true);
    readStatusMock.mockResolvedValueOnce({
      connected: false,
      connecting: false,
      downloading: false,
      hasError: false,
      hasSynced: false,
      lastSyncedAt: null,
      pendingOperations: 2,
      uploading: false,
    });

    render(<PowerSyncPocSurface />);

    expect(await screen.findByText('2 operations waiting')).toBeInTheDocument();
  });

  it('refreshes the upload queue automatically after local persistence', async () => {
    isAllowedMock.mockReturnValue(true);
    readStatusMock
      .mockResolvedValueOnce({
        connected: true,
        connecting: false,
        downloading: false,
        hasError: false,
        hasSynced: true,
        lastSyncedAt: '2026-08-11T12:00:00.000Z',
        pendingOperations: 5,
        uploading: true,
      })
      .mockResolvedValue({
        connected: true,
        connecting: false,
        downloading: false,
        hasError: false,
        hasSynced: true,
        lastSyncedAt: '2026-08-11T12:00:01.000Z',
        pendingOperations: 0,
        uploading: false,
      });
    render(<PowerSyncPocSurface />);

    expect(await screen.findByText('5 operations waiting')).toBeInTheDocument();
    expect(
      await screen.findByText('Queue synchronized', {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    expect(readStatusMock).toHaveBeenCalledTimes(2);
  });
});
