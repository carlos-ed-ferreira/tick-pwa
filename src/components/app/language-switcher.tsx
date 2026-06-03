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
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-[#f8f3ea] shadow-sm shadow-[#312c51]/10 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
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
