import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { CANONICAL_SERVICE_KEYS, type PemabuServiceKey } from "@/lib/constants/services";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function verifyAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

function isPemabuServiceKey(k: string): k is PemabuServiceKey {
  return (CANONICAL_SERVICE_KEYS as readonly string[]).includes(k);
}

const GrantSubscriptionSchema = z.object({
  user_id: z.string().uuid(),
  service_key: z.string().min(1).refine(isPemabuServiceKey, { message: "Unknown service_key" }),
  status: z.enum(["active", "cancelled", "expired", "complimentary", "trial"]).default("active"),
  price_paid_usd: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

export const GET = withAuth(async (_req, user) => {
  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*, service:pemabu_services(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return NextResponse.json({ subscriptions: data });
});

export const POST = withAuth(async (req, user) => {
  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = GrantSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { user_id, service_key, status, price_paid_usd, notes, ends_at } = parsed.data;

  const { data: groupRow } = await supabaseAdmin
    .from("user_group_assignments")
    .select("subscription_group")
    .eq("user_id", user_id)
    .maybeSingle();

  const isBetaUser = groupRow?.subscription_group === "beta";
  const effectivePricePaid = isBetaUser ? null : (price_paid_usd ?? null);

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(
      {
        user_id,
        service_key,
        status,
        price_paid_usd: effectivePricePaid,
        granted_by: user.id,
        notes: notes ?? null,
        ends_at: ends_at ?? null,
      },
      { onConflict: "user_id,service_key" },
    )
    .select("*, service:pemabu_services(*)")
    .single();

  if (error) throw error;
  return NextResponse.json({ subscription: data }, { status: 201 });
});
