'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { Button } from '@/components/ui';
import { LanguageSwitcher } from '@/components/app';
import { AccountStatus, AuthGate } from '@/features/auth';
import { CalendarMonth } from '@/features/calendar';
import { CategoryManagerDialog } from '@/features/categories';
import { useAppContext } from '@/providers';

export default function CalendarPage() {
  const { dictionary } = useAppContext();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const activeNavigationItemClassName =
    'inline-flex h-9 items-center rounded-full border border-white/10 bg-accent px-3 text-sm font-semibold text-primary shadow-sm shadow-[#f0c38e]/10 transition hover:-translate-y-0.5 hover:bg-[#f4cf9c] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]';
  const navigationItemClassName =
    'inline-flex h-9 items-center rounded-full border border-transparent px-3 text-sm font-medium text-[#c4bbda] transition hover:border-white/10 hover:bg-white/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]';

  return (
    <AuthGate>
      <main className="relative isolate min-h-dvh overflow-hidden bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(88,73,137,0.28), transparent 28%), radial-gradient(circle at top right, rgba(240,195,142,0.16), transparent 24%), radial-gradient(circle at 18% 85%, rgba(241,170,155,0.1), transparent 28%)',
          }}
        />
        <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-5 lg:gap-6">
          <header className="grid gap-4 rounded-[2rem] border border-white/10 bg-[rgba(33,27,59,0.84)] px-4 py-4 shadow-[0_28px_72px_rgba(8,6,20,0.24)] backdrop-blur-xl sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:px-6">
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href="/"
                className="w-fit text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-[#d8d0e8] transition hover:text-[#fff9f2]"
              >
                {dictionary.navigation.home}
              </Link>
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {dictionary.calendar.title}
              </h1>
            </div>
            <nav className="flex flex-wrap items-center justify-start gap-1 rounded-full border border-white/10 bg-white/5 p-1 shadow-sm shadow-[#312c51]/10 lg:justify-self-center">
              <Link
                href="/calendar"
                aria-current="page"
                className={activeNavigationItemClassName}
              >
                {dictionary.navigation.calendar}
              </Link>
              <Link href="/goals" className={navigationItemClassName}>
                {dictionary.navigation.goals}
              </Link>
            </nav>
            <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
              <Button
                className="min-h-9 px-3 text-sm"
                tone="subtle"
                onClick={() => setIsCategoryManagerOpen(true)}
              >
                {dictionary.actions.editCategories}
              </Button>
              <AccountStatus />
              <LanguageSwitcher />
            </div>
          </header>
          <Suspense
            fallback={<section className="calendar-shell min-h-[70vh]" />}
          >
            <CalendarMonth />
          </Suspense>
        </div>
        <CategoryManagerDialog
          open={isCategoryManagerOpen}
          surface="calendar"
          title={dictionary.calendar.editCategories}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      </main>
    </AuthGate>
  );
}
