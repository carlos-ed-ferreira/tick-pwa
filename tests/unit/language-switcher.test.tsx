import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    setLocaleMock.mockClear();
  });

  it('shows the short code of the current locale in a borderless pill menu trigger', () => {
    render(<LanguageSwitcher />);

    const trigger = screen.getByRole('button', {
      name: 'Language: English',
    });

    expect(trigger).toHaveTextContent('EN');
    expect(trigger).not.toHaveTextContent('English');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveClass('rounded-full');
    expect(trigger.className).not.toContain('inset-ring');
  });

  it('opens a menu with every locale and switches to the chosen one', () => {
    render(<LanguageSwitcher />);

    const trigger = screen.getByRole('button', { name: 'Language: English' });

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Language' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'English' }),
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Português (Brasil)' }),
    );

    expect(setLocaleMock).toHaveBeenCalledWith('pt-BR');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the current locale when it is chosen again', () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));

    expect(setLocaleMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
