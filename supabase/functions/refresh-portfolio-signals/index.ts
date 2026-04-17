import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import {
  createRefreshHandler,
  type PortfolioRefreshSupabase,
} from "./refresh-handler-core.ts";

export { createRefreshHandler } from "./refresh-handler-core.ts";

export const handleRefreshRequest = createRefreshHandler({
  getEnv: (key) => (typeof Deno !== "undefined" ? Deno.env.get(key) : undefined),
  fetchImpl: fetch,
  createSupabase: (url, key) =>
    createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as PortfolioRefreshSupabase,
});

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve((req: Request) => handleRefreshRequest(req));
}
