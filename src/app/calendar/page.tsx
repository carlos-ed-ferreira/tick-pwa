'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { LanguageSwitcher } from '@/components/app';
import { CalendarMonth } from '@/features/calendar';
import { useAppContext } from '@/providers';

export default function CalendarPage() {
  const { dictionary } = useAppContext();

  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            {dictionary.navigation.home}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {dictionary.calendar.title}
            </h1>
            <LanguageSwitcher />
          </div>
        </header>
        <Suspense
          fallback={
            <section className="min-h-[70vh] rounded-lg border border-border bg-surface shadow-sm" />
          }
        >
          <CalendarMonth />
        </Suspense>
      </div>
    </main>
  );
}
