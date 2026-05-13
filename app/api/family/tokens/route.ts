import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { generateShareToken, hashShareToken, buildShareUrl } from "@/lib/family-sharing/token-service";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

const ADDON = "addon_family_sharing";

async function assertFamily(userId: string): Promise<NextResponse | null> {
  const keys = await getActiveServiceKeysForUser(userId);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Family Sharing subscription required." }, { status: 403 });
  }
  return null;
}

const CreateTokenSchema = z.object({
  viewer_label: z.string().min(1).max(60).optional(),
  show_total_value: z.boolean().optional(),
  show_drift_status: z.boolean().optional(),
  show_allocation_pct: z.boolean().optional(),
  show_sector_weights: z.boolean().optional(),
});

export const GET = withAuth(async (_req, user) => {
  const denied = await assertFamily(user.id);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("family_share_tokens")
    .select(
      "id, viewer_label, show_total_value, show_drift_status, show_allocation_pct, show_sector_weights, is_active, created_at, last_accessed_at",
    )
    .eq("owner_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return NextResponse.json({ tokens: data ?? [] });
});

export const POST = withAuth(async (req, user) => {
  const denied = await assertFamily(user.id);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const viewer_label = d.viewer_label ?? "Family View";
  const show_total_value = d.show_total_value ?? true;
  const show_drift_status = d.show_drift_status ?? true;
  const show_allocation_pct = d.show_allocation_pct ?? true;
  const show_sector_weights = d.show_sector_weights ?? false;

  const rawToken = generateShareToken();
  const tokenHash = hashShareToken(rawToken);

  const { data, error } = await supabaseAdmin
    .from("family_share_tokens")
    .insert({
      owner_user_id: user.id,
      token_hash: tokenHash,
      viewer_label,
      show_total_value,
      show_drift_status,
      show_allocation_pct,
      show_sector_weights,
    })
    .select("id, viewer_label, created_at")
    .single();

  if (error) throw error;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = buildShareUrl(rawToken, base);

  return NextResponse.json({
    token: { ...data },
    rawToken,
    shareUrl,
    warning: "Save this token and share URL now. The raw token cannot be retrieved after this response.",
  });
});
