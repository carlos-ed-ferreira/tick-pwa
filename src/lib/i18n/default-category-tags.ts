import type { SupportedLocale } from '@/lib/domain';

export type DefaultCategoryKey = 'focus' | 'health' | 'home';
export type RemovedDefaultCategoryKey = 'people';
export type AnyDefaultCategoryKey =
  | DefaultCategoryKey
  | RemovedDefaultCategoryKey;

export interface DefaultCategoryTagTemplate<
  TKey extends string = DefaultCategoryKey,
> {
  key: TKey;
  name: string;
  colorHex: string;
}

const defaultCategoryTagTemplates = {
  en: [
    { key: 'focus', name: 'FOCUS', colorHex: '#2563eb' },
    { key: 'health', name: 'HEALTH', colorHex: '#16a34a' },
    { key: 'home', name: 'HOME', colorHex: '#d97706' },
  ],
  'pt-BR': [
    { key: 'focus', name: 'FOCO', colorHex: '#2563eb' },
    { key: 'health', name: 'SAÚDE', colorHex: '#16a34a' },
    { key: 'home', name: 'CASA', colorHex: '#d97706' },
  ],
} as const satisfies Record<
  SupportedLocale,
  readonly DefaultCategoryTagTemplate[]
>;

const removedDefaultCategoryTagTemplates = {
  en: [{ key: 'people', name: 'PEOPLE', colorHex: '#db2777' }],
  'pt-BR': [{ key: 'people', name: 'PESSOAL', colorHex: '#db2777' }],
} as const satisfies Record<
  SupportedLocale,
  readonly DefaultCategoryTagTemplate<RemovedDefaultCategoryKey>[]
>;

export function getDefaultCategoryTagTemplates(
  locale: SupportedLocale,
): readonly DefaultCategoryTagTemplate[] {
  return defaultCategoryTagTemplates[locale];
}

export function getRemovedDefaultCategoryTagTemplates(
  locale: SupportedLocale,
): readonly DefaultCategoryTagTemplate<RemovedDefaultCategoryKey>[] {
  return removedDefaultCategoryTagTemplates[locale];
}
