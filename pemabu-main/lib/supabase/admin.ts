// SERVER-ONLY: Never import from app/, components/, or hooks/
// Permitted only in lib/ service functions and app/api/cron/
// See §8.1 in REBUILD_INVENTORY.md

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _admin;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getAdminClient()[prop as keyof SupabaseClient];
  },
});
