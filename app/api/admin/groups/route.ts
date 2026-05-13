import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function verifyAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

const AssignGroupSchema = z.object({
  user_id: z.string().uuid(),
  subscription_group: z.enum(["beta", "standard", "trial", "alumni"]),
  notes: z.string().nullable().optional(),
});

export const GET = withAuth(async (_req, user) => {
  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_group_assignments")
    .select("*")
    .order("assigned_at", { ascending: false });

  if (error) throw error;
  return NextResponse.json({ assignments: data });
});

export const POST = withAuth(async (req, user) => {
  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = AssignGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { user_id, subscription_group, notes } = parsed.data;

  // Upsert the group assignment (one row per user)
  const { data: assignment, error: assignError } = await supabaseAdmin
    .from("user_group_assignments")
    .upsert(
      {
        user_id,
        subscription_group,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        notes: notes ?? null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (assignError) throw assignError;

  // Beta: atomically grant all active services as complimentary
  if (subscription_group === "beta") {
    const { data: activeServices, error: svcError } = await supabaseAdmin
      .from("pemabu_services")
      .select("service_key")
      .eq("is_active", true);

    if (svcError) throw svcError;

    if (activeServices && activeServices.length > 0) {
      const upserts = activeServices.map((s) => ({
        user_id,
        service_key: s.service_key,
        status: "complimentary" as const,
        price_paid_usd: null as number | null,
        ends_at: null as string | null,
        granted_by: user.id,
        notes: "Auto-granted via beta group assignment",
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert(upserts, { onConflict: "user_id,service_key" });

      if (upsertError) throw upsertError;
    }
  }

  // Alumni: cancel all complimentary subscriptions
  if (subscription_group === "alumni") {
    const { error: cancelError } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: "cancelled",
        notes: "Cancelled: beta membership discontinued (alumni group assignment).",
      })
      .eq("user_id", user_id)
      .eq("status", "complimentary");

    if (cancelError) throw cancelError;
  }

  return NextResponse.json({ assignment }, { status: 201 });
});
