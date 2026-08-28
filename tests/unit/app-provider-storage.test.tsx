import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, useAppContext } from '@/providers/app-provider';

vi.mock('@/lib/db', () => ({
  deleteLocalPreference: vi.fn(),
  getLocalPreference: vi.fn().mockRejectedValue(new Error('IndexedDB blocked')),
  getOrCreateInstallationId: vi.fn(),
  seedDefaultCategoryTags: vi.fn(),
  setLocalPreference: vi.fn(),
}));

vi.mock('@/lib/environment', () => ({
  shouldUseCloudSync: vi.fn(() => false),
  shouldUsePowerSyncPocForUser: vi.fn(() => false),
}));

vi.mock('@/lib/supabase', () => ({
  AccountRefreshCoordinator: class {
    refresh = vi.fn();
  },
  checkUserAccess: vi.fn(),
  ensureUserProfile: vi.fn(),
  getSupabaseBrowserClient: vi.fn(() => null),
  refreshAccountCache: vi.fn(),
  resolveUserAccess: vi.fn(),
  toTickAuthUser: vi.fn(),
}));

function AuthModeProbe() {
  return <span>{useAppContext().authMode}</span>;
}

describe('AppProvider storage fallback', () => {
  it('leaves loading when IndexedDB cannot be opened', async () => {
    render(
      <AppProvider initialLocale="pt-BR">
        <AuthModeProbe />
      </AppProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('storage_error')).toBeVisible();
    });
  });
});
