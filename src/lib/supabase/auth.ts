import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';
import { isTransportUnavailableError } from './transport-errors';

export interface TickAuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export type UserAccessStatus = 'allowed' | 'denied' | 'unavailable';

export interface CachedUserAccess {
  email: string;
  userId: string;
  verifiedAt: string;
}

const USER_ACCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === 'string' && value.trim() ? value : null;
}

export function getNormalizedUserEmail(user: User): string | null {
  return user.email?.trim().toLowerCase() ?? null;
}

export function toTickAuthUser(user: User): TickAuthUser {
  const metadata = user.user_metadata as Record<string, unknown>;

  return {
    id: user.id,
    email: getNormalizedUserEmail(user) ?? '',
    name:
      readMetadataString(metadata, 'full_name') ??
      readMetadataString(metadata, 'name'),
    avatarUrl:
      readMetadataString(metadata, 'avatar_url') ??
      readMetadataString(metadata, 'picture'),
  };
}

function reportAccessCheckFailure(error: unknown) {
  if (isTransportUnavailableError(error)) {
    return;
  }

  const { code, details, hint, message } = (error ?? {}) as Partial<
    Record<'code' | 'details' | 'hint' | 'message', string>
  >;

  console.error('Failed to verify Tick account access.', {
    code,
    details,
    hint,
    message,
  });
}

export async function checkUserAccess(user: User): Promise<UserAccessStatus> {
  const client = getSupabaseBrowserClient();
  const email = getNormalizedUserEmail(user);

  if (!email) {
    return 'denied';
  }

  if (!client) {
    return 'unavailable';
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'unavailable';
  }

  try {
    const { data, error } = await client
      .from('account_access')
      .select('active')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      reportAccessCheckFailure(error);
      return 'unavailable';
    }

    const access = data as { active?: boolean } | null;

    return access?.active === true ? 'allowed' : 'denied';
  } catch (error) {
    reportAccessCheckFailure(error);
    return 'unavailable';
  }
}

export function resolveUserAccess({
  cached,
  now,
  remoteStatus,
  user,
}: {
  cached: CachedUserAccess | null;
  now: Date;
  remoteStatus: UserAccessStatus;
  user: User;
}): UserAccessStatus {
  if (remoteStatus !== 'unavailable') {
    return remoteStatus;
  }

  const email = getNormalizedUserEmail(user);
  const verifiedAt = cached ? Date.parse(cached.verifiedAt) : Number.NaN;
  const age = now.getTime() - verifiedAt;

  return cached &&
    cached.userId === user.id &&
    cached.email === email &&
    Number.isFinite(verifiedAt) &&
    age >= 0 &&
    age <= USER_ACCESS_CACHE_TTL_MS
    ? 'allowed'
    : 'unavailable';
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  const client = getSupabaseBrowserClient();
  const tickUser = toTickAuthUser(user);

  if (!client || !tickUser.email) {
    return;
  }

  try {
    const { error } = await client.from('profiles').upsert(
      {
        id: tickUser.id,
        email: tickUser.email,
        full_name: tickUser.name,
        avatar_url: tickUser.avatarUrl,
        deleted_at: null,
      },
      { onConflict: 'id' },
    );
    if (error) throw error;
  } catch (error) {
    if (!isTransportUnavailableError(error)) throw error;
    console.error(
      'Profile metadata will be retried on the next account activation.',
      error,
    );
  }
}
