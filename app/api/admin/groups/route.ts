import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminErrorResponse, adminResponse } from "@/lib/api/response";
import { bustServiceCatalogCache } from "@/lib/cache/service-catalog";

const AssignGroupSchema = z.object({
  user_id: z.string().uuid(),
  subscription_group: z.enum(["beta", "standard", "trial", "alumni"]),
  notes: z.string().nullable().optional(),
});

export const GET = withAdminAuth(async (_req, _user) => {
  const { data, error } = await supabaseAdmin
    .from("user_group_assignments")
    .select("*")
    .order("assigned_at", { ascending: false });

  if (error) throw error;
  return adminResponse(data ?? []);
});

export const POST = withAdminAuth(async (req, user) => {
  const body: unknown = await req.json();
  const parsed = AssignGroupSchema.safeParse(body);
  if (!parsed.success) {
    return adminErrorResponse(JSON.stringify(parsed.error.flatten()), 422);
  }

  const { user_id, subscription_group, notes } = parsed.data;

  if (subscription_group === "beta") {
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("assign_beta_grant_atomic", {
      p_user_id: user_id,
      p_assigned_by: user.id,
      p_notes: notes ?? null,
    });

    if (rpcError) throw rpcError;

    const result = rpcResult as {
      success: boolean;
      services_granted?: number;
      error?: string;
    };

    if (!result.success) {
      return adminErrorResponse(result.error ?? "Beta group assignment failed", 500);
    }

    const { data: assignment, error: fetchErr } = await supabaseAdmin
      .from("user_group_assignments")
      .select()
      .eq("user_id", user_id)
      .single();
    if (fetchErr) throw fetchErr;

    bustServiceCatalogCache();
    return NextResponse.json(
      {
        data: {
          success: true,
          group: "beta",
          services_granted: result.services_granted,
          assignment,
        },
        meta: { count: 1, timestamp: new Date().toISOString() },
      },
      { status: 201 },
    );
  }

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

  bustServiceCatalogCache();
  return NextResponse.json(
    {
      data: { assignment },
      meta: { count: 1, timestamp: new Date().toISOString() },
    },
    { status: 201 },
  );
});
