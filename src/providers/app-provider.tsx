'use client';

import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppScope, LocalePreference, SupportedLocale } from '@/lib/domain';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  getLocalPreference,
  getOrCreateInstallationId,
  seedDefaultCategoryTags,
  setLocalPreference,
} from '@/lib/db';
import {
  DEFAULT_LOCALE,
  detectInitialLocale,
  getDictionary,
  writeStoredLocale,
  type Dictionary,
} from '@/lib/i18n';
import {
  ensureUserProfile,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  isUserAllowed,
  toTickAuthUser,
  type TickAuthUser,
} from '@/lib/supabase';
import { synchronizeScope } from '@/lib/sync';
import { resolveTimezonePreference } from '@/lib/time';

export type AuthMode =
  | 'loading'
  | 'entry'
  | 'guest'
  | 'authenticated'
  | 'unauthorized';

type AccessModePreference = 'entry' | 'local';

const ACCESS_MODE_PREFERENCE_KEY = 'accessMode';
const APP_INITIALIZATION_TIMEOUT_MS = 3000;
const INITIAL_AUTH_SESSION_TIMEOUT_MS = 2000;

async function getInitialAuthUser(): Promise<User | null> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return null;
  }

  let timeoutId: number | null = null;
  const sessionPromise = client.auth
    .getSession()
    .then((sessionResponse) => sessionResponse.data.session?.user ?? null)
    .catch((error) => {
      console.error('Failed to read Supabase auth session.', error);
      return null;
    });
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(
      () => resolve(null),
      INITIAL_AUTH_SESSION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([sessionPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

interface AppContextValue {
  scope: AppScope | null;
  locale: SupportedLocale;
  dictionary: Dictionary;
  timezonePreference: LocalePreference;
  isReady: boolean;
  authMode: AuthMode;
  authUser: TickAuthUser | null;
  authError: string | null;
  isLoginConfigured: boolean;
  setLocale: (locale: SupportedLocale) => void;
  openAuthEntry: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  enterLocalMode: () => Promise<void>;
  signOut: () => Promise<void>;
  requestSync: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}) {
  const [scope, setScope] = useState<AppScope | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('loading');
  const [authUser, setAuthUser] = useState<TickAuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);
  const [timezonePreference, setTimezonePreference] =
    useState<LocalePreference>(() => resolveTimezonePreference(initialLocale));
  const syncInProgressRef = useRef(false);

  const applyScopedPreferences = useCallback(
    async (nextScope: AppScope | null) => {
      const storedLocale = nextScope
        ? await getLocalPreference<SupportedLocale>('locale', nextScope)
        : null;
      const nextLocale = storedLocale ?? detectInitialLocale();
      const nextTimezonePreference = resolveTimezonePreference(
        nextLocale,
        storedLocale ? 'manual' : 'browser',
      );

      if (nextScope && !storedLocale) {
        await setLocalPreference('locale', nextLocale, nextScope);
        await setLocalPreference(
          'timezonePreference',
          nextTimezonePreference,
          nextScope,
        );
      }

      writeStoredLocale(nextLocale);
      setLocaleState(nextLocale);
      setTimezonePreference(nextTimezonePreference);

      return nextLocale;
    },
    [],
  );

  const runScopedSync = useCallback(async (nextScope: AppScope) => {
    if (nextScope.kind === 'guest' || syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;

    try {
      await synchronizeScope(nextScope);
    } catch (error) {
      console.error('Failed to synchronize Tick data.', error);
    } finally {
      syncInProgressRef.current = false;
    }
  }, []);

  const activateLocalMode = useCallback(
    async ({ persistChoice }: { persistChoice: boolean }) => {
      const installationId = await getOrCreateInstallationId();
      const guestScope = createGuestScope(installationId);
      const nextLocale = await applyScopedPreferences(guestScope);

      await seedDefaultCategoryTags(guestScope, nextLocale);

      if (persistChoice) {
        await setLocalPreference<AccessModePreference>(
          ACCESS_MODE_PREFERENCE_KEY,
          'local',
        );
      }

      setScope(guestScope);
      setAuthUser(null);
      setAuthError(null);
      setAuthMode('guest');
      setIsReady(true);
    },
    [applyScopedPreferences],
  );

  const activateEntryMode = useCallback(async () => {
    await applyScopedPreferences(null);
    setScope(null);
    setAuthUser(null);
    setAuthMode('entry');
    setIsReady(true);
  }, [applyScopedPreferences]);

  const activateUnauthorizedMode = useCallback(
    async (user: User) => {
      await applyScopedPreferences(null);
      setScope(null);
      setAuthUser(toTickAuthUser(user));
      setAuthError(null);
      setAuthMode('unauthorized');
      setIsReady(true);
    },
    [applyScopedPreferences],
  );

  const activateAuthenticatedMode = useCallback(
    async (user: User) => {
      const allowed = await isUserAllowed(user);

      if (!allowed) {
        await activateUnauthorizedMode(user);
        return;
      }

      const userScope = createUserScope(user.id);

      await ensureUserProfile(user);
      await applyScopedPreferences(userScope);
      await runScopedSync(userScope);

      await setLocalPreference<AccessModePreference>(
        ACCESS_MODE_PREFERENCE_KEY,
        'entry',
      );

      setScope(userScope);
      setAuthUser(toTickAuthUser(user));
      setAuthError(null);
      setAuthMode('authenticated');
      setIsReady(true);
    },
    [activateUnauthorizedMode, applyScopedPreferences, runScopedSync],
  );

  useEffect(() => {
    let isActive = true;
    let didResolveInitialScope = false;
    const initializationTimeoutId = window.setTimeout(() => {
      if (!isActive || didResolveInitialScope) {
        return;
      }

      didResolveInitialScope = true;
      void activateEntryMode();
    }, APP_INITIALIZATION_TIMEOUT_MS);

    async function resolveInitialScope(action: () => Promise<void>) {
      if (!isActive || didResolveInitialScope) {
        return;
      }

      didResolveInitialScope = true;
      window.clearTimeout(initializationTimeoutId);
      await action();
    }

    async function initializeAppScope() {
      try {
        const sessionUser = await getInitialAuthUser();

        if (!isActive) {
          return;
        }

        if (sessionUser) {
          await resolveInitialScope(() =>
            activateAuthenticatedMode(sessionUser),
          );
          return;
        }

        const accessMode = await getLocalPreference<AccessModePreference>(
          ACCESS_MODE_PREFERENCE_KEY,
        );

        if (!isActive) {
          return;
        }

        if (accessMode === 'local') {
          await resolveInitialScope(() =>
            activateLocalMode({ persistChoice: false }),
          );
          return;
        }

        await resolveInitialScope(activateEntryMode);
      } catch (error) {
        console.error('Failed to initialize Tick app scope.', error);

        if (isActive) {
          await resolveInitialScope(activateEntryMode);
        }
      }
    }

    void initializeAppScope();

    return () => {
      isActive = false;
      window.clearTimeout(initializationTimeoutId);
    };
  }, [activateAuthenticatedMode, activateEntryMode, activateLocalMode]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      return;
    }

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void activateAuthenticatedMode(session.user);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [activateAuthenticatedMode]);

  useEffect(() => {
    if (authMode !== 'authenticated' || !scope) {
      return;
    }

    const sync = () => {
      void runScopedSync(scope);
    };

    sync();
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    const syncInterval = window.setInterval(sync, 8000);

    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
      window.clearInterval(syncInterval);
    };
  }, [authMode, runScopedSync, scope]);

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
        void (async () => {
          await setLocalPreference('locale', nextLocale, scope);
          await setLocalPreference(
            'timezonePreference',
            nextTimezonePreference,
            scope,
          );

          if (scope.kind === 'guest') {
            await seedDefaultCategoryTags(scope, nextLocale);
          }
        })();
      }
    },
    [scope],
  );

  const signInWithGoogle = useCallback(async () => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setAuthError('Supabase is not configured for this environment.');
      return;
    }

    setAuthError(null);

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseBrowserClient();

      if (!client) {
        setAuthError('Supabase is not configured for this environment.');
        return;
      }

      setAuthError(null);

      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthError(error.message);
      }
    },
    [],
  );

  const openAuthEntry = useCallback(async () => {
    await setLocalPreference<AccessModePreference>(
      ACCESS_MODE_PREFERENCE_KEY,
      'entry',
    );
    await activateEntryMode();
  }, [activateEntryMode]);

  const enterLocalMode = useCallback(async () => {
    const client = getSupabaseBrowserClient();

    if (client) {
      await client.auth.signOut();
    }

    await activateLocalMode({ persistChoice: true });
  }, [activateLocalMode]);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();

    if (client) {
      await client.auth.signOut();
    }

    await setLocalPreference<AccessModePreference>(
      ACCESS_MODE_PREFERENCE_KEY,
      'entry',
    );
    await activateEntryMode();
  }, [activateEntryMode]);

  const requestSync = useCallback(async () => {
    if (!scope || scope.kind === 'guest') {
      return;
    }

    await runScopedSync(scope);
  }, [runScopedSync, scope]);

  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  const value = useMemo<AppContextValue>(
    () => ({
      authError,
      authMode,
      authUser,
      scope,
      locale,
      dictionary,
      timezonePreference,
      isReady,
      isLoginConfigured: isSupabaseConfigured(),
      setLocale,
      openAuthEntry,
      signInWithGoogle,
      signInWithPassword,
      enterLocalMode,
      signOut,
      requestSync,
    }),
    [
      authError,
      authMode,
      authUser,
      dictionary,
      enterLocalMode,
      isReady,
      locale,
      openAuthEntry,
      requestSync,
      scope,
      setLocale,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      timezonePreference,
    ],
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
