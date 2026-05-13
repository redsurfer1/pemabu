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
  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("pemabu_services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return NextResponse.json({ services: data });
});

export const PATCH = withAuth(async (req, user) => {
  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = PatchServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { service_key, ...updates } = parsed.data;

  // service_key identifies the row only; it must never be updated via PATCH
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pemabu_services")
    .update(updates)
    .eq("service_key", service_key)
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ service: data });
});
