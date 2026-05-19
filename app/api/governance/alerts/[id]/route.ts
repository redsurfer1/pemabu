import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

const ADDON = "addon_governance_alerts";

const UpdateSchema = z.object({
  is_read: z.boolean().optional(),
  is_dismissed: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, user, context) => {
  await assertServiceAccess(user.id, ADDON);

  const params = await context.params;
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("governance_user_alerts")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  return NextResponse.json({ success: true });
}, { keyTemplate: "governance:{userId}", ...MUTATION_RATE_LIMIT });
