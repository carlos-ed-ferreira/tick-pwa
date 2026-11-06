'use client';

import { CalendarDays, Repeat } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { TbTargetArrow } from 'react-icons/tb';
import {
  activePillTabClassName,
  pillTabClassName,
  pillTabListClassName,
} from '@/components/ui';
import { LanguageSwitcher } from '@/components/app/language-switcher';
import { AccountStatus } from '@/features/auth/account-status';
import { AccountSyncIndicator } from '@/features/auth/account-sync-indicator';
import { useAppContext } from '@/providers';

export type AppSection = 'calendar' | 'goals' | 'recurring';

const navigationItemLayoutClassName =
  'flex-1 sm:flex-none touch:min-w-0 touch:gap-1 touch:px-2 touch:text-xs';
const activeNavigationItemClassName = `${activePillTabClassName} ${navigationItemLayoutClassName}`;
const navigationItemClassName = `${pillTabClassName} ${navigationItemLayoutClassName}`;

export function AppHeader({ activeSection }: { activeSection: AppSection }) {
  const { authMode, dictionary, scope } = useAppContext();

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 touch:flex touch:gap-2">
      <div className="flex min-w-0 items-center gap-2 touch:flex-1 sm:gap-3">
        <Image
          alt=""
          aria-hidden="true"
          className="size-9 shrink-0 object-contain sm:size-11"
          height={44}
          priority
          src="/icons/tick-icon.svg"
          width={44}
        />
        <p className="hidden min-w-0 truncate text-sm font-semibold uppercase tracking-[0.28em] text-[#cbd5e0] lg:block">
          {dictionary.app.name}
        </p>
      </div>

      <nav className="flex items-center justify-self-center">
        <div
          className={`app-bottom-nav ${pillTabListClassName} backdrop-blur-md touch:rounded-none touch:p-1.5`}
        >
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
          <Link
            href="/recurring"
            aria-current={activeSection === 'recurring' ? 'page' : undefined}
            className={
              activeSection === 'recurring'
                ? activeNavigationItemClassName
                : navigationItemClassName
            }
          >
            <Repeat aria-hidden="true" className="size-4" />
            {dictionary.navigation.recurring}
          </Link>
        </div>
      </nav>

      <div
        className="flex min-w-0 flex-wrap items-center justify-end gap-2 touch:shrink-0"
        data-header-actions
      >
        {authMode === 'authenticated' ? (
          <AccountSyncIndicator dictionary={dictionary.sync} scope={scope} />
        ) : null}
        <LanguageSwitcher />
        <AccountStatus />
      </div>
    </header>
  );
}
