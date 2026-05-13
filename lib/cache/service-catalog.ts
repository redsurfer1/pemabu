// SERVICE CATALOG CACHE — pemabu_services is stable; cache 10 minutes.

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PemabuService } from "@/lib/types/database";

const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedServices: PemabuService[] | null = null;
let cacheExpiresAt = 0;

export async function getCachedServices(): Promise<PemabuService[]> {
  if (cachedServices && Date.now() < cacheExpiresAt) {
    return cachedServices;
  }

  const { data, error } = await supabaseAdmin
    .from("pemabu_services")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  cachedServices = (data ?? []) as PemabuService[];
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedServices;
}

export function bustServiceCatalogCache(): void {
  cachedServices = null;
  cacheExpiresAt = 0;
}
