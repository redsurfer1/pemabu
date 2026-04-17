import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Browser Supabase client. Must use @supabase/ssr createBrowserClient so the
 * session is stored in cookies that middleware, Server Components, and API
 * routes can read via createServerClient. Plain @supabase/supabase-js
 * createClient() defaults to localStorage-only and causes "blank" dashboards
 * and 401s on /api/workbook/* after sign-in.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
