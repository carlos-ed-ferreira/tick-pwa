'use client';

import { Languages } from 'lucide-react';
import type { SupportedLocale } from '@/lib/domain';
import { LOCALE_LABELS } from '@/lib/i18n';
import { useAppContext } from '@/providers';

const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  'pt-BR': '🇧🇷',
  en: '🇺🇸',
};

export function LanguageSwitcher() {
  const { dictionary, isReady, locale, setLocale } = useAppContext();
  const nextLocale: SupportedLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';

  return (
    <button
      aria-label={`${dictionary.settings.language}: ${LOCALE_LABELS[locale]}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#fff9f2]/55 bg-background/75 px-5 py-2 text-sm font-semibold text-foreground shadow-sm shadow-[#312c51]/8 transition hover:-translate-y-0.5 hover:border-[#fff9f2]/90 hover:bg-background/92 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff9f2] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={!isReady}
      type="button"
      onClick={() => setLocale(nextLocale)}
    >
      <span aria-hidden="true">{LOCALE_FLAGS[locale]}</span>
      <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
      <Languages aria-hidden="true" className="size-3.5 opacity-70" />
    </button>
  );
}
