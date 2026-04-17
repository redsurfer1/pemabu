// SERVER-ONLY: Never import from app/, components/, or hooks/
// Permitted only in lib/ service functions and app/api/cron/
// See §8.1 in REBUILD_INVENTORY.md

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export { supabaseAdmin };
