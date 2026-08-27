'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/app';
import { AuthGate } from '@/features/auth';
import { GoalsSurface } from '@/features/goals';
import { CategoryManagerDialog } from '@/features/categories';
import { useAppContext } from '@/providers';

export default function GoalsPage() {
  const { dictionary } = useAppContext();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  return (
    <AuthGate>
      <main className="app-safe-padding relative isolate min-h-dvh overflow-hidden bg-background pt-5 text-foreground [--app-safe-padding-block-end:1.25rem] [--app-safe-padding-inline:1rem] sm:[--app-safe-padding-inline:1.5rem] lg:[--app-safe-padding-inline:2rem]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(62,85,110,0.28), transparent 28%), radial-gradient(circle at top right, rgba(240,195,142,0.16), transparent 24%), radial-gradient(circle at 18% 85%, rgba(165,190,218,0.1), transparent 28%)',
          }}
        />
        <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-4">
          <AppHeader
            activeSection="goals"
            onOpenCategories={() => setIsCategoryManagerOpen(true)}
          />
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
