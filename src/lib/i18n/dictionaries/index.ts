import type { SupportedLocale } from '@/lib/domain';
import { enDictionary } from './en';
import { ptBRDictionary } from './pt-BR';
import type { Dictionary } from './types';

export type { Dictionary } from './types';

export const dictionaries: Record<SupportedLocale, Dictionary> = {
  'pt-BR': ptBRDictionary,
  en: enDictionary,
};

export function getDictionary(locale: SupportedLocale): Dictionary {
  return dictionaries[locale];
}
