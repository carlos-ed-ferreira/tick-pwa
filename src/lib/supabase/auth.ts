import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';

export interface TickAuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

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

export async function isUserAllowed(user: User): Promise<boolean> {
  const client = getSupabaseBrowserClient();
  const email = getNormalizedUserEmail(user);

  if (!client || !email) {
    return false;
  }

  const { data, error } = await client
    .from('account_access')
    .select('active')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Failed to verify Tick account access.', error);
    return false;
  }

  const access = data as { active?: boolean } | null;

  return access?.active === true;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const client = getSupabaseBrowserClient();
  const tickUser = toTickAuthUser(user);

  if (!client || !tickUser.email) {
    return;
  }

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

  if (error) {
    throw error;
  }
}
