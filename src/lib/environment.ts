const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export function isLocalhostHostname(
  hostname: string | null | undefined,
): boolean {
  return typeof hostname === 'string' && LOCALHOST_HOSTNAMES.has(hostname);
}

export function shouldForceLocalOnlyMode({
  hostname,
  disableSupabase,
  allowSupabaseOnLocalhost,
}: {
  hostname: string | null | undefined;
  disableSupabase: boolean;
  allowSupabaseOnLocalhost: boolean;
}): boolean {
  if (disableSupabase) {
    return true;
  }

  return isLocalhostHostname(hostname) && !allowSupabaseOnLocalhost;
}

export function shouldUseCloudSyncOnHostname({
  hostname,
  disableSupabase,
  allowSupabaseOnLocalhost,
}: {
  hostname: string | null | undefined;
  disableSupabase: boolean;
  allowSupabaseOnLocalhost: boolean;
}): boolean {
  if (disableSupabase) {
    return false;
  }

  return !isLocalhostHostname(hostname) || allowSupabaseOnLocalhost;
}

export function shouldUseCloudSync(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return shouldUseCloudSyncOnHostname({
    hostname: window.location.hostname,
    disableSupabase: process.env.NEXT_PUBLIC_TICK_DISABLE_SUPABASE === '1',
    allowSupabaseOnLocalhost:
      process.env.NEXT_PUBLIC_TICK_ALLOW_SUPABASE_ON_LOCALHOST === '1',
  });
}
