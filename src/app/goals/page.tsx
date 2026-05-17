'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/app';
import { AccountStatus, AuthGate } from '@/features/auth';
import { GoalsSurface } from '@/features/goals';
import { useAppContext } from '@/providers';

export default function GoalsPage() {
  const { dictionary } = useAppContext();
  const activeNavigationItemClassName =
    'inline-flex h-9 items-center rounded-full px-3 text-sm font-medium bg-foreground text-background shadow-sm';
  const navigationItemClassName =
    'inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground';
  return (
    <AuthGate>
      <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/"
                className="text-sm font-semibold tracking-wide text-muted transition hover:text-foreground"
              >
                {dictionary.navigation.home}
              </Link>
              <span aria-hidden="true" className="h-4 w-px bg-border" />
              <h1 className="truncate text-xl font-semibold">
                {dictionary.goals.title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-sm">
                <Link href="/calendar" className={navigationItemClassName}>
                  {dictionary.navigation.calendar}
                </Link>
                <Link
                  href="/goals"
                  aria-current="page"
                  className={activeNavigationItemClassName}
                >
                  {dictionary.navigation.goals}
                </Link>
                <Link href="/categories" className={navigationItemClassName}>
                  {dictionary.navigation.categories}
                </Link>
              </nav>
              <AccountStatus />
              <LanguageSwitcher />
            </div>
          </header>
          <GoalsSurface />
        </div>
      </main>
    </AuthGate>
  );
}
