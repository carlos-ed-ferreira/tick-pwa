import type { SupportedLocale } from '@/lib/domain';
import { DEFAULT_LOCALE, normalizeLocale } from './locales';

export const LOCALE_STORAGE_KEY = 'tick.locale';

export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage can be unavailable in private contexts; locale still works in memory.
  }
}

export function detectBrowserLocale(): SupportedLocale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const languageCandidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ];

  for (const language of languageCandidates) {
    const supportedLocale = normalizeLocale(language);

    if (supportedLocale) {
      return supportedLocale;
    }
  }

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (browserTimezone === 'America/Sao_Paulo') {
    return 'pt-BR';
  }

  return null;
}

export function detectInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? detectBrowserLocale() ?? DEFAULT_LOCALE;
}
