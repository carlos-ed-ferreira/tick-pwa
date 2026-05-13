'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppScope, LocalePreference, SupportedLocale } from '@/lib/domain';
import { createGuestScope } from '@/lib/domain';
import {
  getLocalPreference,
  getOrCreateInstallationId,
  seedDefaultCategoryTags,
  setLocalPreference,
} from '@/lib/db';
import {
  detectInitialLocale,
  getDictionary,
  writeStoredLocale,
  type Dictionary,
} from '@/lib/i18n';
import { resolveTimezonePreference } from '@/lib/time';

interface AppContextValue {
  scope: AppScope | null;
  locale: SupportedLocale;
  dictionary: Dictionary;
  timezonePreference: LocalePreference;
  isReady: boolean;
  setLocale: (locale: SupportedLocale) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const initialLocale = detectInitialLocale();
  const [scope, setScope] = useState<AppScope | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);
  const [timezonePreference, setTimezonePreference] =
    useState<LocalePreference>(() => resolveTimezonePreference(initialLocale));

  useEffect(() => {
    let isActive = true;

    async function initializeGuestScope() {
      try {
        const installationId = await getOrCreateInstallationId();
        const guestScope = createGuestScope(installationId);
        await seedDefaultCategoryTags(guestScope);

        const storedLocale = await getLocalPreference<SupportedLocale>(
          'locale',
          guestScope,
        );
        const nextLocale = storedLocale ?? detectInitialLocale();
        const nextTimezonePreference = resolveTimezonePreference(
          nextLocale,
          storedLocale ? 'manual' : 'browser',
        );

        if (!storedLocale) {
          await setLocalPreference('locale', nextLocale, guestScope);
          await setLocalPreference(
            'timezonePreference',
            nextTimezonePreference,
            guestScope,
          );
        }

        if (isActive) {
          setScope(guestScope);
          setLocaleState(nextLocale);
          setTimezonePreference(nextTimezonePreference);
          setIsReady(true);
        }
      } catch (error) {
        console.error('Failed to initialize Tick local scope.', error);

        if (isActive) {
          setIsReady(true);
        }
      }
    }

    void initializeGuestScope();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (nextLocale: SupportedLocale) => {
      const nextTimezonePreference = resolveTimezonePreference(
        nextLocale,
        'manual',
      );

      setLocaleState(nextLocale);
      setTimezonePreference(nextTimezonePreference);
      writeStoredLocale(nextLocale);

      if (scope) {
        void setLocalPreference('locale', nextLocale, scope);
        void setLocalPreference(
          'timezonePreference',
          nextTimezonePreference,
          scope,
        );
      }
    },
    [scope],
  );

  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  const value = useMemo<AppContextValue>(
    () => ({
      scope,
      locale,
      dictionary,
      timezonePreference,
      isReady,
      setLocale,
    }),
    [dictionary, isReady, locale, scope, setLocale, timezonePreference],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider.');
  }

  return context;
}
