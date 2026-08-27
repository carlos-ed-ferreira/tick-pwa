import { render, screen } from '@testing-library/react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
  SVGProps,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';

const iconMock = (name: string) =>
  function IconMock({
    className,
    ...props
  }: SVGProps<SVGSVGElement> & { 'data-icon'?: string }) {
    return <svg data-icon={name} className={className} {...props} />;
  };

vi.mock('lucide-react', () => ({
  CalendarDays: iconMock('CalendarDays'),
  Tags: iconMock('Tags'),
  Trophy: iconMock('Trophy'),
}));

vi.mock('react-icons/tb', () => ({
  TbTargetArrow: iconMock('TbTargetArrow'),
}));

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <span {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/app/language-switcher', () => ({
  LanguageSwitcher: () => null,
}));

vi.mock('@/components/app', async () => ({
  AppHeader: (await import('@/components/app/app-header')).AppHeader,
  LanguageSwitcher: () => null,
}));

vi.mock('@/features/auth/account-status', () => ({
  AccountStatus: () => null,
}));

vi.mock('@/features/auth/account-sync-indicator', () => ({
  AccountSyncIndicator: () => <span data-testid="sync-control" />,
}));

vi.mock('@/features/auth', () => ({
  AccountStatus: () => null,
  AccountSyncIndicator: () => <span data-testid="sync-control" />,
  AuthGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/calendar', () => ({
  CalendarMonth: () => <div data-testid="calendar-month" />,
}));

vi.mock('@/features/categories', () => ({
  CategoryManagerDialog: () => null,
}));

vi.mock('@/features/goals', () => ({
  GoalsSurface: () => <div data-testid="goals-surface" />,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    authMode: 'authenticated',
    dictionary: ptBRDictionary,
    scope: { id: 'user:test', kind: 'user', ownerId: 'test' },
  }),
}));

describe('navigation labels and icons', () => {
  it('shows the updated pt-BR calendar label in the dictionary', () => {
    expect(ptBRDictionary.navigation.calendar).toBe('Tarefas do dia');
  });

  it('renders the goals navigation icon as a target arrow on both pages', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');
    const { default: GoalsPage } = await import('@/app/goals/page');

    const { unmount } = render(<CalendarPage />);

    expect(
      screen
        .getByRole('link', { name: 'Metas' })
        .querySelector('svg[data-icon="TbTargetArrow"]'),
    ).toBeTruthy();

    unmount();

    render(<GoalsPage />);

    expect(
      screen
        .getByRole('link', { name: 'Metas' })
        .querySelector('svg[data-icon="TbTargetArrow"]'),
    ).toBeTruthy();
  });

  it('places the sync control before the calendar and goals selector', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');
    const { default: GoalsPage } = await import('@/app/goals/page');

    const { container: calendarContainer, unmount } = render(<CalendarPage />);

    expect(
      calendarContainer.querySelector('nav')?.firstElementChild,
    ).toHaveAttribute('data-testid', 'sync-control');

    unmount();

    const { container: goalsContainer } = render(<GoalsPage />);

    expect(
      goalsContainer.querySelector('nav')?.firstElementChild,
    ).toHaveAttribute('data-testid', 'sync-control');
  });
});
