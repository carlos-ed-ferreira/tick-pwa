import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/environment', () => ({ shouldAllowSupabaseClient: () => true }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('never uses the browser HTTP cache for account authorization or data reads', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:56321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-local-key');
  const request = vi.fn<typeof fetch>(
    async () =>
      new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', request);
  const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
  const client = getSupabaseBrowserClient()!;
  await client.from('account_access').select('active');
  expect(request).toHaveBeenCalled();
  expect(request.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
});
