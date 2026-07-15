import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazily create the server-side client so importing this module never throws
// at build/collect-page-data time when env vars aren't present.
//
// Prefers the service-role key (bypasses RLS, needed for writes in the cron).
// Falls back to the anon key for read-only rendering when the service key isn't
// present in the runtime env — the news_* tables have public-read RLS policies,
// so anon can SELECT them. Writes still require the service key.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Proxy so existing call sites (`supabaseAdmin.from(...)`) keep working while
// deferring client creation until the property is actually accessed.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
