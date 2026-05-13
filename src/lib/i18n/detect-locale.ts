import type { SupportedLocale } from '@/lib/domain';
import { DEFAULT_LOCALE, normalizeLocale } from './locales';

export const LOCALE_STORAGE_KEY = 'tick.locale';
export const LOCALE_COOKIE_KEY = 'tick.locale';

const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

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
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage can be unavailable in private contexts; locale still works in memory.
  }

  try {
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; path=/; max-age=${localeCookieMaxAgeSeconds}; samesite=lax`;
  } catch {
    // Cookie writes can fail in restricted contexts; locale still works in memory.
  }
}

export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): SupportedLocale | null {
  if (!acceptLanguage) {
    return null;
  }

  for (const candidate of acceptLanguage.split(',')) {
    const locale = normalizeLocale(candidate.split(';', 1)[0]?.trim());

    if (locale) {
      return locale;
    }
  }

  return null;
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

export function detectRequestLocale({
  cookieLocale,
  acceptLanguage,
}: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): SupportedLocale {
  return (
    normalizeLocale(cookieLocale) ??
    detectLocaleFromAcceptLanguage(acceptLanguage) ??
    DEFAULT_LOCALE
  );
}
