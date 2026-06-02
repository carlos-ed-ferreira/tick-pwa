import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from '@/components/app';

const { setLocaleMock } = vi.hoisted(() => ({
  setLocaleMock: vi.fn(),
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      settings: { language: 'Language' },
    },
    isReady: true,
    locale: 'en',
    setLocale: setLocaleMock,
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    setLocaleMock.mockClear();
  });

  it('renders the current locale as a visible button and toggles to the other locale', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button', {
      name: 'Language: English',
    });

    expect(button).toHaveTextContent('🇺🇸');
    expect(button).toHaveTextContent('English');
    expect(button).toHaveClass('border');

    fireEvent.click(button);

    expect(setLocaleMock).toHaveBeenCalledWith('pt-BR');
  });
});
