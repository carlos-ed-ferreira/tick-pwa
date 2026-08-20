const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const LOCAL_SUPABASE_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export type TickSupabaseEnvironment = 'local' | 'production';

export function isLocalhostHostname(
  hostname: string | null | undefined,
): boolean {
  return typeof hostname === 'string' && LOCALHOST_HOSTNAMES.has(hostname);
}

export function shouldForceLocalOnlyMode({
  hostname,
  disableSupabase,
  supabaseEnvironment,
  supabaseUrl,
}: {
  hostname: string | null | undefined;
  disableSupabase: boolean;
  supabaseEnvironment: string | null | undefined;
  supabaseUrl: string | null | undefined;
}): boolean {
  if (disableSupabase) {
    return true;
  }

  return !shouldUseCloudSyncOnHostname({
    hostname,
    disableSupabase,
    supabaseEnvironment,
    supabaseUrl,
  });
}

export function shouldUseCloudSyncOnHostname({
  hostname,
  disableSupabase,
  supabaseEnvironment,
  supabaseUrl,
}: {
  hostname: string | null | undefined;
  disableSupabase: boolean;
  supabaseEnvironment: string | null | undefined;
  supabaseUrl: string | null | undefined;
}): boolean {
  if (disableSupabase) {
    return false;
  }

  const normalizedEnvironment =
    normalizeSupabaseEnvironment(supabaseEnvironment);

  if (!normalizedEnvironment) {
    return false;
  }

  if (isLocalhostHostname(hostname)) {
    return normalizedEnvironment === 'local' && isLocalSupabaseUrl(supabaseUrl);
  }

  return normalizedEnvironment === 'production';
}

export function shouldAllowSupabaseClientOnHostname({
  hostname,
  disableSupabase,
  supabaseEnvironment,
  supabaseUrl,
}: {
  hostname: string | null | undefined;
  disableSupabase: boolean;
  supabaseEnvironment: string | null | undefined;
  supabaseUrl: string | null | undefined;
}): boolean {
  return shouldUseCloudSyncOnHostname({
    hostname,
    disableSupabase,
    supabaseEnvironment,
    supabaseUrl,
  });
}

export function shouldUseCloudSync(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return shouldUseCloudSyncOnHostname({
    hostname: window.location.hostname,
    disableSupabase: process.env.NEXT_PUBLIC_TICK_DISABLE_SUPABASE === '1',
    supabaseEnvironment: process.env.NEXT_PUBLIC_TICK_SUPABASE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

export function shouldUsePowerSyncPocOnHostname({
  hostname,
  disableSupabase,
  enablePowerSyncPoc,
  powerSyncUrl,
  supabaseEnvironment,
  supabaseUrl,
}: {
  hostname: string | null | undefined;
  disableSupabase: boolean;
  enablePowerSyncPoc: boolean;
  powerSyncUrl: string | null | undefined;
  supabaseEnvironment: string | null | undefined;
  supabaseUrl: string | null | undefined;
}): boolean {
  if (
    !enablePowerSyncPoc ||
    !shouldUseCloudSyncOnHostname({
      hostname,
      disableSupabase,
      supabaseEnvironment,
      supabaseUrl,
    })
  ) {
    return false;
  }

  try {
    return new URL(powerSyncUrl ?? '').protocol === 'https:';
  } catch {
    return false;
  }
}

export function shouldUsePowerSyncPoc(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return shouldUsePowerSyncPocOnHostname({
    hostname: window.location.hostname,
    disableSupabase: process.env.NEXT_PUBLIC_TICK_DISABLE_SUPABASE === '1',
    enablePowerSyncPoc:
      process.env.NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC === '1',
    powerSyncUrl: process.env.NEXT_PUBLIC_POWERSYNC_URL,
    supabaseEnvironment: process.env.NEXT_PUBLIC_TICK_SUPABASE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

export function isPowerSyncPocUserAllowed(
  userId: string | null | undefined,
  allowedUserIds: string | null | undefined,
): boolean {
  if (!userId || !allowedUserIds) {
    return false;
  }

  return allowedUserIds
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .includes(userId);
}

export function shouldUsePowerSyncPocForUser(
  userId: string | null | undefined,
): boolean {
  return (
    shouldUsePowerSyncPoc() &&
    isPowerSyncPocUserAllowed(
      userId,
      process.env.NEXT_PUBLIC_TICK_POWERSYNC_POC_USER_IDS,
    )
  );
}

export function shouldUseAccountOperationBatchesForUser(
  userId: string | null | undefined,
): boolean {
  return (
    process.env.NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES === '1' &&
    isPowerSyncPocUserAllowed(
      userId,
      process.env.NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS,
    )
  );
}

export function shouldAllowSupabaseClient(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return shouldAllowSupabaseClientOnHostname({
    hostname: window.location.hostname,
    disableSupabase: process.env.NEXT_PUBLIC_TICK_DISABLE_SUPABASE === '1',
    supabaseEnvironment: process.env.NEXT_PUBLIC_TICK_SUPABASE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

function normalizeSupabaseEnvironment(
  value: string | null | undefined,
): TickSupabaseEnvironment | null {
  if (value === 'local' || value === 'production') {
    return value;
  }

  return null;
}

function isLocalSupabaseUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return LOCAL_SUPABASE_HOSTNAMES.has(parsedUrl.hostname);
  } catch {
    return false;
  }
}
