import { cleanup, render, screen } from '@testing-library/react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
  SVGProps,
} from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  Languages: iconMock('Languages'),
  MoreHorizontal: iconMock('MoreHorizontal'),
  Repeat: iconMock('Repeat'),
  Tags: iconMock('Tags'),
  Trophy: iconMock('Trophy'),
  X: iconMock('X'),
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

vi.mock('@/components/ui', async () => ({
  ...(await import('@/components/ui/filled-control')),
  BottomSheet: (await import('@/components/ui/bottom-sheet')).BottomSheet,
  BottomSheetAction: (await import('@/components/ui/bottom-sheet'))
    .BottomSheetAction,
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  }) => <button {...props}>{children}</button>,
  IconButton: (await import('@/components/ui/icon-button')).IconButton,
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

afterEach(() => {
  cleanup();
});

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

  it('keeps only the section links inside the centered selector and the sync control among the actions', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');
    const { default: GoalsPage } = await import('@/app/goals/page');

    for (const Page of [CalendarPage, GoalsPage]) {
      const { container, unmount } = render(<Page />);
      const navigation = container.querySelector('nav');
      const actions = container.querySelector('[data-header-actions]');

      expect(
        [...(navigation?.querySelectorAll('a') ?? [])].map((link) =>
          link.getAttribute('href'),
        ),
      ).toEqual(['/recurring', '/calendar', '/goals']);
      expect(
        navigation?.querySelector('[data-testid="sync-control"]'),
      ).toBeNull();
      expect(
        actions?.querySelector('[data-testid="sync-control"]'),
      ).not.toBeNull();

      unmount();
    }
  });

  it('renders the section selector as filled pills without borders', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');

    const { container } = render(<CalendarPage />);
    const selector = container.querySelector('.app-bottom-nav');
    const activeLink = screen.getByRole('link', { name: 'Tarefas do dia' });
    const inactiveLink = screen.getByRole('link', { name: 'Metas' });

    expect(selector).toHaveClass('rounded-full');
    expect(selector?.className).not.toContain('inset-ring');
    expect(activeLink).toHaveClass('rounded-full', 'bg-[#f0c38e]');
    expect(activeLink.className).not.toContain('inset-ring');
    expect(inactiveLink).toHaveClass('rounded-full');
    expect(inactiveLink.className).not.toContain('inset-ring');
  });

  it('does not offer categories in the header of either section', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');
    const { default: GoalsPage } = await import('@/app/goals/page');

    for (const Page of [CalendarPage, GoalsPage]) {
      const { unmount } = render(<Page />);

      expect(
        screen.queryByRole('button', { name: 'Categorias' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Mais opções' }),
      ).not.toBeInTheDocument();

      unmount();
    }
  });
});

describe('touch navigation bar', () => {
  it('reuses the single navigation pill as the bottom bar', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');

    const { container } = render(<CalendarPage />);

    expect(screen.getAllByRole('link', { name: 'Metas' })).toHaveLength(1);
    expect(
      screen.getAllByRole('link', { name: 'Tarefas do dia' }),
    ).toHaveLength(1);
    expect(container.querySelectorAll('.app-bottom-nav')).toHaveLength(1);
  });

  it('keeps the navigation links reachable by touch', async () => {
    const { default: CalendarPage } = await import('@/app/calendar/page');

    render(<CalendarPage />);

    expect(screen.getByRole('link', { name: 'Metas' }).className).toContain(
      'touch-target',
    );
  });
});
