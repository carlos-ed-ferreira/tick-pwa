'use client';

import { useState, Suspense } from 'react';
import { AppHeader } from '@/components/app';
import { AuthGate } from '@/features/auth';
import { CalendarMonth } from '@/features/calendar';
import { CategoryManagerDialog } from '@/features/categories';
import { useAppContext } from '@/providers';

export default function CalendarPage() {
  const { dictionary } = useAppContext();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  return (
    <AuthGate>
      <main className="app-safe-padding relative isolate min-h-dvh overflow-hidden bg-background pt-5 text-foreground [--app-safe-padding-block-end:1.25rem] [--app-safe-padding-inline:1rem] sm:[--app-safe-padding-inline:1.5rem] lg:[--app-safe-padding-inline:2rem] lg:has-[.calendar-shell]:h-dvh">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(62,85,110,0.28), transparent 28%), radial-gradient(circle at top right, rgba(240,195,142,0.16), transparent 24%), radial-gradient(circle at 18% 85%, rgba(165,190,218,0.1), transparent 28%)',
          }}
        />
        <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-4 lg:min-h-0 lg:has-[.calendar-shell]:h-full">
          <AppHeader
            activeSection="calendar"
            onOpenCategories={() => setIsCategoryManagerOpen(true)}
          />
          <Suspense
            fallback={
              <section className="calendar-shell min-h-[70vh] lg:min-h-0 lg:flex-1" />
            }
          >
            <CalendarMonth />
          </Suspense>
        </div>
        <CategoryManagerDialog
          open={isCategoryManagerOpen}
          surface="checklist_item"
          title={dictionary.calendar.editCategories}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      </main>
    </AuthGate>
  );
}
