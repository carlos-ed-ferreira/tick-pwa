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
import { ToastViewport } from '@/components/ui';
import { createGuestScope, createUserScope } from '@/lib/domain';
import {
  shouldUseCloudSync,
  shouldUsePowerSyncPocForUser,
} from '@/lib/environment';
import {
  deleteLocalPreference,
  getLocalPreference,
  getOrCreateInstallationId,
  seedDefaultCategoryTags,
  setLocalPreference,
} from '@/lib/db';
import { resumeAccountPersistence } from '@/lib/db/account-persistence';
import {
  DEFAULT_LOCALE,
  detectInitialLocale,
  getDictionary,
  writeStoredLocale,
  type Dictionary,
} from '@/lib/i18n';
import {
  checkUserAccess,
  ensureUserProfile,
  AccountRefreshCoordinator,
  getSupabaseBrowserClient,
  refreshAccountCache,
  resolveUserAccess,
  toTickAuthUser,
  type CachedUserAccess,
  type TickAuthUser,
  type AccountRefreshReason,
} from '@/lib/supabase';
import { resolveTimezonePreference } from '@/lib/time';

export type AuthMode =
  | 'loading'
  | 'entry'
  | 'guest'
  | 'authenticated'
  | 'unauthorized'
  | 'storage_error';
export type PasswordSignInResult =
  | { status: 'authenticated' }
  | { status: 'not_allowed' }
  | { status: 'invalid_credentials' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

type AccessModePreference = 'entry' | 'local';

const ACCESS_MODE_PREFERENCE_KEY = 'accessMode';
const ACCOUNT_ACCESS_PREFERENCE_KEY = 'verifiedAccountAccess';
const APP_INITIALIZATION_TIMEOUT_MS = 3000;
const INITIAL_AUTH_SESSION_TIMEOUT_MS = 2000;
const ACCOUNT_REFRESH_DEBOUNCE_MS = 500;

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
  setLocale: (locale: SupportedLocale) => void;
  openAuthEntry: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<PasswordSignInResult>;
  enterLocalMode: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
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
  const accountRefreshCoordinatorRef = useRef<AccountRefreshCoordinator | null>(
    null,
  );

  if (accountRefreshCoordinatorRef.current == null) {
    accountRefreshCoordinatorRef.current = new AccountRefreshCoordinator(
      refreshAccountCache,
    );
  }

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

  const refreshScopedAccountCache = useCallback(
    async (
      nextScope: AppScope,
      reason: AccountRefreshReason,
      force = false,
    ) => {
      if (!shouldUseCloudSync() || nextScope.kind === 'guest') {
        return;
      }

      try {
        await accountRefreshCoordinatorRef.current?.refresh(
          nextScope,
          reason,
          force,
        );
      } catch (error) {
        console.error('Failed to refresh Tick account data.', error);
      }
    },
    [],
  );

  const activateLocalMode = useCallback(
    async ({ persistChoice }: { persistChoice: boolean }) => {
      const installationId = await getOrCreateInstallationId();
      const guestScope = createGuestScope(installationId);
      const nextLocale = await applyScopedPreferences(guestScope);

      await seedDefaultCategoryTags(guestScope, nextLocale, 'checklist_item');
      await seedDefaultCategoryTags(guestScope, nextLocale, 'goal_group');
      await seedDefaultCategoryTags(guestScope, nextLocale, 'goal');
      await seedDefaultCategoryTags(guestScope, nextLocale, 'goal_step');

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

  const activateStorageErrorMode = useCallback(() => {
    setScope(null);
    setAuthUser(null);
    setAuthError(null);
    setAuthMode('storage_error');
    setIsReady(true);
  }, []);

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
    async (
      user: User,
    ): Promise<'authenticated' | 'not_allowed' | 'unavailable'> => {
      const userScope = createUserScope(user.id);
      const remoteAccessStatus = await checkUserAccess(user);
      const cachedAccess =
        remoteAccessStatus === 'unavailable'
          ? await getLocalPreference<CachedUserAccess>(
              ACCOUNT_ACCESS_PREFERENCE_KEY,
              userScope,
            )
          : null;
      const accessStatus = resolveUserAccess({
        cached: cachedAccess,
        now: new Date(),
        remoteStatus: remoteAccessStatus,
        user,
      });

      if (remoteAccessStatus === 'allowed' && user.email) {
        await setLocalPreference<CachedUserAccess>(
          ACCOUNT_ACCESS_PREFERENCE_KEY,
          {
            email: user.email.trim().toLowerCase(),
            userId: user.id,
            verifiedAt: new Date().toISOString(),
          },
          userScope,
        );
      } else if (remoteAccessStatus === 'denied') {
        await deleteLocalPreference(ACCOUNT_ACCESS_PREFERENCE_KEY, userScope);
      }

      if (accessStatus === 'denied') {
        await activateUnauthorizedMode(user);
        return 'not_allowed';
      }

      if (accessStatus === 'unavailable') {
        await activateEntryMode();
        return 'unavailable';
      }

      if (!shouldUseCloudSync()) {
        await activateEntryMode();
        setAuthError('Supabase is not configured for this environment.');
        return 'unavailable';
      }

      if (remoteAccessStatus === 'allowed') {
        await ensureUserProfile(user);
      }
      await applyScopedPreferences(userScope);

      if (remoteAccessStatus === 'allowed') {
        await refreshScopedAccountCache(userScope, 'session');
      }

      await setLocalPreference<AccessModePreference>(
        ACCESS_MODE_PREFERENCE_KEY,
        'entry',
      );

      setScope(userScope);
      setAuthUser(toTickAuthUser(user));
      setAuthError(null);
      setAuthMode('authenticated');
      setIsReady(true);
      return 'authenticated';
    },
    [
      activateEntryMode,
      activateUnauthorizedMode,
      applyScopedPreferences,
      refreshScopedAccountCache,
    ],
  );

  useEffect(() => {
    let isActive = true;
    let didResolveInitialScope = false;
    const initializationTimeoutId = window.setTimeout(() => {
      if (!isActive || didResolveInitialScope) {
        return;
      }

      didResolveInitialScope = true;
      void activateEntryMode().catch(activateStorageErrorMode);
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
          await resolveInitialScope(async () => {
            await activateAuthenticatedMode(sessionUser);
          });
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
          didResolveInitialScope = true;
          window.clearTimeout(initializationTimeoutId);
          activateStorageErrorMode();
        }
      }
    }

    void initializeAppScope();

    return () => {
      isActive = false;
      window.clearTimeout(initializationTimeoutId);
    };
  }, [
    activateAuthenticatedMode,
    activateEntryMode,
    activateLocalMode,
    activateStorageErrorMode,
  ]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();

    if (!client || !shouldUseCloudSync()) {
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
    if (authMode !== 'authenticated' || scope?.kind !== 'user') {
      return;
    }

    void resumeAccountPersistence(scope).catch((error) => {
      console.error('Failed to resume Tick account persistence.', error);
    });
  }, [authMode, scope]);

  useEffect(() => {
    if (
      authMode !== 'authenticated' ||
      scope?.kind !== 'user' ||
      !shouldUsePowerSyncPocForUser(scope.ownerId)
    ) {
      return;
    }

    let isActive = true;
    const runtimePromise = import('@/lib/powersync/runtime');

    void runtimePromise
      .then(async ({ startPowerSyncPoc }) => {
        if (!isActive) {
          return;
        }

        await startPowerSyncPoc(scope);
      })
      .catch((error) => {
        console.error('Failed to update PowerSync proof of concept.', error);
      });

    return () => {
      isActive = false;
      void runtimePromise
        .then(({ stopPowerSyncPoc }) => stopPowerSyncPoc())
        .catch((error) => {
          console.error('Failed to stop PowerSync proof of concept.', error);
        });
    };
  }, [authMode, scope]);

  useEffect(() => {
    if (authMode !== 'authenticated' || !scope || !shouldUseCloudSync()) {
      return;
    }

    let refreshTimeoutId: number | null = null;
    const scheduleRefresh = (reason: AccountRefreshReason) => {
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
      }

      refreshTimeoutId = window.setTimeout(() => {
        refreshTimeoutId = null;

        if (reason === 'online') {
          void resumeAccountPersistence(scope).catch((error) => {
            console.error(
              'Failed to resume Tick account persistence after reconnect.',
              error,
            );
          });
        }

        void refreshScopedAccountCache(scope, reason);
      }, ACCOUNT_REFRESH_DEBOUNCE_MS);
    };
    const refreshOnline = () => scheduleRefresh('online');
    const refreshFocused = () => scheduleRefresh('focus');

    window.addEventListener('online', refreshOnline);
    window.addEventListener('focus', refreshFocused);

    return () => {
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener('focus', refreshFocused);

      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
      }
    };
  }, [authMode, refreshScopedAccountCache, scope]);

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
            await seedDefaultCategoryTags(scope, nextLocale, 'checklist_item');
            await seedDefaultCategoryTags(scope, nextLocale, 'goal_group');
            await seedDefaultCategoryTags(scope, nextLocale, 'goal');
            await seedDefaultCategoryTags(scope, nextLocale, 'goal_step');
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
    async (email: string, password: string): Promise<PasswordSignInResult> => {
      const client = getSupabaseBrowserClient();

      if (!client) {
        setAuthError('Supabase is not configured for this environment.');
        return { status: 'unavailable' } satisfies PasswordSignInResult;
      }

      setAuthError(null);

      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const isInvalidCredentials =
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid credentials');

        if (isInvalidCredentials) {
          return {
            status: 'invalid_credentials',
          } satisfies PasswordSignInResult;
        }

        setAuthError(error.message);
        return { status: 'error', message: error.message };
      }

      if (!data.user) {
        const message = 'Supabase did not return an authenticated user.';
        setAuthError(message);
        return { status: 'error', message };
      }

      const activationResult = await activateAuthenticatedMode(data.user);

      return { status: activationResult } satisfies PasswordSignInResult;
    },
    [activateAuthenticatedMode],
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

    if (!shouldUseCloudSync()) {
      await activateLocalMode({ persistChoice: false });
      return;
    }

    await setLocalPreference<AccessModePreference>(
      ACCESS_MODE_PREFERENCE_KEY,
      'entry',
    );
    await activateEntryMode();
  }, [activateEntryMode, activateLocalMode]);

  const refreshAccountData = useCallback(async () => {
    if (!scope || scope.kind === 'guest' || !shouldUseCloudSync()) {
      return;
    }

    await refreshScopedAccountCache(scope, 'manual', true);
  }, [refreshScopedAccountCache, scope]);

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
      setLocale,
      openAuthEntry,
      signInWithGoogle,
      signInWithPassword,
      enterLocalMode,
      signOut,
      refreshAccountData,
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
      refreshAccountData,
      scope,
      setLocale,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      timezonePreference,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastViewport closeLabel={dictionary.actions.dismissNotification} />
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider.');
  }

  return context;
}
