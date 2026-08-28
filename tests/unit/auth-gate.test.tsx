import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthGate } from '@/features/auth/auth-gate';
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';

vi.mock('next/image', () => ({
  default: () => <span />,
}));

vi.mock('@/components/app', () => ({
  LanguageSwitcher: () => null,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    authMode: 'storage_error',
    dictionary: ptBRDictionary,
    isReady: true,
    scope: null,
  }),
}));

describe('AuthGate storage fallback', () => {
  it('shows a recoverable message when local storage is unavailable', () => {
    render(
      <AuthGate>
        <span>Protected content</span>
      </AuthGate>,
    );

    expect(
      screen.getByRole('heading', {
        name: /armazenamento local indisponível/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /tentar abrir novamente/i }),
    ).toBeVisible();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
