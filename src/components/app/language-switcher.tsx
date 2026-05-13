'use client';

import type { SupportedLocale } from '@/lib/domain';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@/lib/i18n';
import { useAppContext } from '@/providers';

export function LanguageSwitcher() {
  const { dictionary, isReady, locale, setLocale } = useAppContext();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{dictionary.settings.language}</span>
      <select
        aria-label={dictionary.settings.language}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-foreground"
        disabled={!isReady}
        value={locale}
        onChange={(event) => setLocale(event.target.value as SupportedLocale)}
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {LOCALE_LABELS[supportedLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
