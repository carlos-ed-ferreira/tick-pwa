'use client';

import { CalendarDays, Tags } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { TbTargetArrow } from 'react-icons/tb';
import { Button } from '@/components/ui';
import { LanguageSwitcher } from '@/components/app';
import { AccountStatus, AuthGate } from '@/features/auth';
import { GoalsSurface } from '@/features/goals';
import { CategoryManagerDialog } from '@/features/categories';
import { useAppContext } from '@/providers';

export default function GoalsPage() {
  const { dictionary } = useAppContext();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const activeNavigationItemClassName =
    'inline-flex min-h-9 items-center gap-2 rounded-[0.875rem] border border-[#f8d7aa]/70 bg-[#f0c38e] px-3.5 text-sm font-semibold text-[#253241] shadow-[0_12px_28px_rgba(240,195,142,0.16)] transition hover:-translate-y-0.5 hover:border-[#ffe0b8] hover:bg-[#f5d09f] hover:shadow-[0_16px_34px_rgba(240,195,142,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]';
  const navigationItemClassName =
    'inline-flex min-h-9 items-center gap-2 rounded-[0.875rem] border border-transparent px-3.5 text-sm font-medium text-[#b4c1ce] transition hover:border-white/10 hover:bg-white/8 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]';
  return (
    <AuthGate>
      <main className="relative isolate min-h-dvh overflow-hidden bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(62,85,110,0.28), transparent 28%), radial-gradient(circle at top right, rgba(240,195,142,0.16), transparent 24%), radial-gradient(circle at 18% 85%, rgba(165,190,218,0.1), transparent 28%)',
          }}
        />
        <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-4">
          <header className="grid gap-3 pt-3 sm:pt-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-3 lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="size-11 shrink-0 object-contain"
                  height={44}
                  priority
                  src="/icons/tick-icon.svg"
                  width={44}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold uppercase tracking-[0.28em] text-[#cbd5e0]">
                    {dictionary.app.name}
                  </p>
                </div>
              </div>
              <AccountStatus />
            </div>

            <nav className="flex w-full flex-wrap items-center justify-start gap-1 rounded-[1rem] border border-white/10 bg-white/6 p-1.5 shadow-sm shadow-[#253241]/10 backdrop-blur-md sm:w-fit lg:justify-self-center">
              <Link href="/calendar" className={navigationItemClassName}>
                <CalendarDays aria-hidden="true" className="size-4" />
                {dictionary.navigation.calendar}
              </Link>
              <Link
                href="/goals"
                aria-current="page"
                className={activeNavigationItemClassName}
              >
                <TbTargetArrow aria-hidden="true" className="size-4" />
                {dictionary.navigation.goals}
              </Link>
            </nav>

            <div className="flex flex-wrap items-center gap-2 lg:justify-between">
              <Button
                className="min-h-9 rounded-full border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-[#f8f3ea] shadow-sm shadow-[#253241]/10 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-[#f7d9b0] sm:text-sm"
                tone="subtle"
                onClick={() => setIsCategoryManagerOpen(true)}
              >
                <Tags aria-hidden="true" className="size-4 text-[#f0c38e]" />
                {dictionary.navigation.categories}
              </Button>
              <LanguageSwitcher />
            </div>
          </header>
          <GoalsSurface />
        </div>
        <CategoryManagerDialog
          open={isCategoryManagerOpen}
          surface="goal"
          title={dictionary.goals.editCategories}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      </main>
    </AuthGate>
  );
}
