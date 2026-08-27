'use client';

import { CalendarDays, Tags } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { TbTargetArrow } from 'react-icons/tb';
import { Button } from '@/components/ui';
import { LanguageSwitcher } from '@/components/app/language-switcher';
import { AccountStatus } from '@/features/auth/account-status';
import { AccountSyncIndicator } from '@/features/auth/account-sync-indicator';
import { useAppContext } from '@/providers';

export type AppSection = 'calendar' | 'goals';

const navigationRadiusBySection: Record<AppSection, string> = {
  calendar: 'rounded-[0.4rem]',
  goals: 'rounded-[0.5rem]',
};

export function AppHeader({
  activeSection,
  onOpenCategories,
}: {
  activeSection: AppSection;
  onOpenCategories: () => void;
}) {
  const { authMode, dictionary, scope } = useAppContext();
  const navigationRadius = navigationRadiusBySection[activeSection];
  const activeNavigationItemClassName = `inline-flex min-h-9 flex-1 items-center justify-center gap-2 ${navigationRadius} inset-ring-hairline inset-ring-[#f8d7aa]/70 bg-[#f0c38e] px-3.5 text-sm font-semibold text-[#253241] shadow-[0_12px_28px_rgba(240,195,142,0.16)] transition hover:-translate-y-0.5 hover:inset-ring-[#ffe0b8] hover:bg-[#f5d09f] hover:shadow-[0_16px_34px_rgba(240,195,142,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] sm:flex-none sm:justify-start`;
  const navigationItemClassName = `inline-flex min-h-9 flex-1 items-center justify-center gap-2 ${navigationRadius} inset-ring-hairline inset-ring-transparent px-3.5 text-sm font-medium text-[#b4c1ce] transition hover:inset-ring-white/10 hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] sm:flex-none sm:justify-start`;

  return (
    <header className="grid gap-3 pt-3 sm:pt-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image
            alt=""
            aria-hidden="true"
            className="size-9 shrink-0 object-contain sm:size-11"
            height={44}
            priority
            src="/icons/tick-icon.svg"
            width={44}
          />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold uppercase tracking-[0.28em] text-[#cbd5e0]">
              {dictionary.app.name}
            </p>
          </div>
        </div>
        <AccountStatus />
      </div>

      <nav className="flex w-full flex-wrap items-center gap-2 sm:w-fit lg:justify-self-center">
        {authMode === 'authenticated' ? (
          <AccountSyncIndicator dictionary={dictionary.sync} scope={scope} />
        ) : null}
        <div className="flex w-full flex-wrap items-center justify-start gap-1 rounded-[0.5rem] inset-ring-hairline inset-ring-white/10 bg-white/6 p-1.5 shadow-sm shadow-[#253241]/10 backdrop-blur-md sm:w-auto">
          <Link
            href="/calendar"
            aria-current={activeSection === 'calendar' ? 'page' : undefined}
            className={
              activeSection === 'calendar'
                ? activeNavigationItemClassName
                : navigationItemClassName
            }
          >
            <CalendarDays aria-hidden="true" className="size-4" />
            {dictionary.navigation.calendar}
          </Link>
          <Link
            href="/goals"
            aria-current={activeSection === 'goals' ? 'page' : undefined}
            className={
              activeSection === 'goals'
                ? activeNavigationItemClassName
                : navigationItemClassName
            }
          >
            <TbTargetArrow aria-hidden="true" className="size-4" />
            {dictionary.navigation.goals}
          </Link>
        </div>
      </nav>

      <div className="flex flex-wrap items-center gap-2 lg:justify-between">
        <Button
          className="min-h-9 rounded-full inset-ring-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-[#f8f3ea] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:inset-ring-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-[#f7d9b0] sm:text-sm"
          tone="subtle"
          onClick={onOpenCategories}
        >
          <Tags aria-hidden="true" className="size-4 text-[#f0c38e]" />
          {dictionary.navigation.categories}
        </Button>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
