import type { SupportedLocale } from '@/lib/domain';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const SUPPORTED_LOCALES = [
  'pt-BR',
  'en',
] as const satisfies readonly SupportedLocale[];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
};

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export function normalizeLocale(
  locale: string | null | undefined,
): SupportedLocale | null {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim().replace('_', '-');
  const lowerLocale = normalized.toLowerCase();

  if (lowerLocale === 'pt-br' || lowerLocale.startsWith('pt-')) {
    return 'pt-BR';
  }

  if (lowerLocale === 'en' || lowerLocale.startsWith('en-')) {
    return 'en';
  }

  return isSupportedLocale(normalized) ? normalized : null;
}
