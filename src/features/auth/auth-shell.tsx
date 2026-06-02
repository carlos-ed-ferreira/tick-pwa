'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/app';
import { Text } from '@/components/ui';
import { useAppContext } from '@/providers';

type AuthShellProps = {
  badge: string;
  children: ReactNode;
  subtitle: string;
  title: string;
};

export function AuthShell({
  badge,
  children,
  subtitle,
  title,
}: AuthShellProps) {
  const { dictionary } = useAppContext();

  return (
    <main className="relative isolate flex min-h-dvh overflow-hidden bg-background px-5 py-10 text-foreground sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'radial-gradient(circle at top left, rgba(72,66,109,0.22), transparent 34%), radial-gradient(circle at top right, rgba(240,195,142,0.18), transparent 30%), radial-gradient(circle at 18% 86%, rgba(241,170,155,0.12), transparent 28%), linear-gradient(180deg, rgba(72,66,109,0.10) 0%, rgba(72,66,109,0.05) 28%, rgba(240,195,142,0.05) 56%, transparent 84%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-foreground/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 bottom-[-5rem] h-72 w-72 rounded-full bg-foreground/5 blur-3xl"
      />

      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
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
              <p className="truncate text-sm font-semibold uppercase tracking-[0.28em] text-muted">
                {dictionary.app.name}
              </p>
            </div>
          </div>

          <LanguageSwitcher />
        </header>

        <section className="card-surface-strong overflow-hidden backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
            <div className="flex h-full flex-col px-5 py-6 sm:px-6 sm:py-7 lg:min-h-[38rem] lg:px-8 lg:py-8">
              <div className="mt-6 flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-background/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted shadow-sm">
                  {badge}
                </span>
              </div>
              <div className="flex flex-1 items-center">
                <div className="max-w-xl">
                  <div className="space-y-4">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                      {title}
                    </h1>
                    <Text
                      as="p"
                      className="max-w-prose"
                      leading="relaxed"
                      size="base"
                      tone="muted"
                    >
                      {subtitle}
                    </Text>
                  </div>
                  <div className="grid gap-3 rounded-[0.75rem] bg-background/45 p-4 shadow-inner mt-12 sm:max-w-lg">
                    <div className="grid gap-1">
                      <p className="text-sm font-semibold text-foreground">
                        {dictionary.auth.allowedOnly}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {dictionary.auth.noSignup}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-0 bg-background/25 px-5 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
              <div className="mx-auto flex w-full max-w-xl flex-col gap-5 lg:pt-8">
                {children}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
