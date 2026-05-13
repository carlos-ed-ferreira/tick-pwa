'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/app';
import { useAppContext } from '@/providers';

export default function GoalsPage() {
  const { dictionary } = useAppContext();
  const categories = [
    dictionary.goals.categories.short,
    dictionary.goals.categories.medium,
    dictionary.goals.categories.long,
  ];

  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            {dictionary.navigation.home}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{dictionary.goals.title}</h1>
            <LanguageSwitcher />
          </div>
        </header>
        <section className="grid gap-3 sm:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category}
              className="min-h-32 rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <h2 className="font-medium">{category}</h2>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
