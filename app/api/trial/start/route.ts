import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

// Self-serve trial start. One trial per user, ever.
// Delegates to the start_trial_self_serve() PL/pgSQL RPC which is idempotent.
export const POST = withAuth(async (_req, user) => {
  const { data, error } = await supabaseAdmin.rpc("start_trial_self_serve", {
    p_user_id: user.id,
  });

  if (error) {
    console.error("trial/start rpc error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; group?: string; ends_at?: string; services_granted?: number };

  if (!result.ok) {
    if (result.error === "already_in_group") {
      return NextResponse.json(
        {
          error: "You are already in the trial or another access group.",
          code: "ALREADY_IN_GROUP",
          group: result.group,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: result.error ?? "Trial start failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    group: "trial",
    ends_at: result.ends_at,
    services_granted: result.services_granted,
  });
}, { keyTemplate: "trial:{userId}", ...MUTATION_RATE_LIMIT });
