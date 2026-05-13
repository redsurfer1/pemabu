import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminErrorResponse, adminResponse } from "@/lib/api/response";
import { bustServiceCatalogCache, getCachedServices } from "@/lib/cache/service-catalog";

const PatchServiceSchema = z
  .object({
    service_key: z.string().min(1),
    display_name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    price_usd: z.number().nonnegative().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  })
  .strict();

export const GET = withAuth(async (_req, user) => {
  void user;
  const data = await getCachedServices();
  return adminResponse(data);
});

export const PATCH = withAuth(async (req, user) => {
  void user;
  const body: unknown = await req.json();
  const parsed = PatchServiceSchema.safeParse(body);
  if (!parsed.success) {
    return adminErrorResponse(JSON.stringify(parsed.error.flatten()), 422);
  }

  const { service_key, ...updates } = parsed.data;

  if (Object.keys(updates).length === 0) {
    return adminErrorResponse("No fields to update", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("pemabu_services")
    .update(updates)
    .eq("service_key", service_key)
    .select()
    .single();

  if (error) throw error;
  bustServiceCatalogCache();
  return adminResponse(data);
});
