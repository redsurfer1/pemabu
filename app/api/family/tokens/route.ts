import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT, READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { getBaseUrl } from "@/lib/app-url";
import { generateShareToken, hashShareToken, buildShareUrl } from "@/lib/family-sharing/token-service";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_family_sharing";

const CreateTokenSchema = z.object({
  viewer_label: z.string().min(1).max(60).optional(),
  portfolio_id: z.string().uuid().optional(),
  show_total_value: z.boolean().optional(),
  show_drift_status: z.boolean().optional(),
  show_allocation_pct: z.boolean().optional(),
  show_sector_weights: z.boolean().optional(),
});

export const GET = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, ADDON);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("family_share_tokens")
    .select(
      "id, viewer_label, show_total_value, show_drift_status, show_allocation_pct, show_sector_weights, is_active, created_at, last_accessed_at",
    )
    .eq("owner_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return NextResponse.json({ tokens: data ?? [] });
}, { keyTemplate: "family:{userId}", ...READ_RATE_LIMIT });

export const POST = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, ADDON);
  const supabase = await createClient();

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

  let portfolioId: string | null = d.portfolio_id ?? null;
  if (portfolioId) {
    const { data: owned } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("family_share_tokens")
    .insert({
      owner_user_id: user.id,
      token_hash: tokenHash,
      viewer_label,
      portfolio_id: portfolioId,
      show_total_value,
      show_drift_status,
      show_allocation_pct,
      show_sector_weights,
    })
    .select("id, viewer_label, created_at")
    .single();

  if (error) throw error;

  const base = getBaseUrl();
  const shareUrl = buildShareUrl(rawToken, base);

  return NextResponse.json({
    token: { ...data },
    rawToken,
    shareUrl,
    warning: "Save this token and share URL now. The raw token cannot be retrieved after this response.",
  });
}, { keyTemplate: "family:{userId}", ...MUTATION_RATE_LIMIT });
