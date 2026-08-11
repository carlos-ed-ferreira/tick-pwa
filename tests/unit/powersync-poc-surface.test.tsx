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

const { isAllowedMock, readSnapshotMock, startMock, writeBatchMock } =
  vi.hoisted(() => ({
    isAllowedMock: vi.fn(() => false),
    readSnapshotMock: vi.fn().mockResolvedValue({
      categoryTags: [],
      checklistItems: [],
      dailyEntries: [],
    }),
    startMock: vi.fn().mockResolvedValue(undefined),
    writeBatchMock: vi.fn().mockResolvedValue(true),
  }));

vi.mock('@/lib/environment', () => ({
  shouldUsePowerSyncPocForUser: isAllowedMock,
}));

vi.mock('@/lib/powersync/runtime', () => ({
  readPowerSyncPocSnapshot: readSnapshotMock,
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
      },
      auth: { loading: 'Loading' },
    },
    scope: createUserScope('account-user'),
    timezonePreference: { timezone: 'America/Sao_Paulo' },
  }),
}));

describe('PowerSyncPocSurface', () => {
  afterEach(() => {
    cleanup();
    isAllowedMock.mockReset();
    isAllowedMock.mockReturnValue(false);
    readSnapshotMock.mockClear();
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
    ).toEqual(['categoryTag', 'dailyEntry', 'checklistItem', 'checklistItem']);
  });
});
