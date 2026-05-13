import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashShareToken } from "@/lib/family-sharing/token-service";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || !token.startsWith("pemabu_share_")) {
    return NextResponse.json({ error: "Invalid token format." }, { status: 401 });
  }

  const tokenHash = hashShareToken(token);

  const { data: matchedToken, error } = await supabaseAdmin
    .from("family_share_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("family view lookup:", error.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  if (!matchedToken) {
    return NextResponse.json({ error: "Token not found or revoked." }, { status: 401 });
  }

  const { error: logErr } = await supabaseAdmin.from("family_share_access_log").insert({ token_id: matchedToken.id });
  if (logErr) console.error("family_share_access_log:", logErr.message);

  const { error: upErr } = await supabaseAdmin
    .from("family_share_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", matchedToken.id);
  if (upErr) console.error("family_share_tokens touch:", upErr.message);

  return NextResponse.json({
    scope: {
      owner_user_id: matchedToken.owner_user_id,
      viewer_label: matchedToken.viewer_label,
      show_total_value: matchedToken.show_total_value,
      show_drift_status: matchedToken.show_drift_status,
      show_allocation_pct: matchedToken.show_allocation_pct,
      show_sector_weights: matchedToken.show_sector_weights,
    },
  });
}
