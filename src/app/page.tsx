'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/app';
import { AccountStatus, AuthGate } from '@/features/auth';
import { useAppContext } from '@/providers';

const destinations = [
  {
    href: '/calendar',
    dictionaryKey: 'calendar',
  },
  {
    href: '/goals',
    dictionaryKey: 'goals',
  },
] as const;

export default function Home() {
  const { dictionary } = useAppContext();

  return (
    <AuthGate>
      <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground sm:px-8">
        <section className="mx-auto flex w-full max-w-md flex-col gap-8">
          <header className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold">{dictionary.app.name}</h1>
              <LanguageSwitcher />
            </div>
            <AccountStatus />
          </header>

          <nav aria-label="Primary" className="grid gap-3">
            {destinations.map((destination) => (
              <Link
                key={destination.href}
                href={destination.href}
                className="group card-surface-soft flex min-h-16 items-center justify-between px-4 text-lg font-medium transition hover:-translate-y-0.5 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                <span>{dictionary.navigation[destination.dictionaryKey]}</span>
                <span
                  aria-hidden="true"
                  className="text-muted transition group-hover:text-foreground"
                >
                  -&gt;
                </span>
              </Link>
            ))}
          </nav>
        </section>
      </main>
    </AuthGate>
  );
}
