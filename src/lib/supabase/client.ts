import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { shouldAllowSupabaseClient } from '@/lib/environment';

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_TICK_DISABLE_SUPABASE === '1') {
    return false;
  }

  if (typeof window !== 'undefined' && !shouldAllowSupabaseClient()) {
    return false;
  }

  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      },
    );
  }

  return browserClient;
}
