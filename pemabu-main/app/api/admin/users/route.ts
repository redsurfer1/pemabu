import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function verifyAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export const GET = withAuth(async (req, user, _ctx) => {
  const isAdmin = await verifyAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: listData, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;

  const users = listData?.users ?? [];

  const { data: profiles } = await supabaseAdmin.from("user_profiles").select("*");

  const merged = users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at,
    profile: profiles?.find((p) => p.id === u.id) ?? null,
  }));

  return NextResponse.json({ users: merged });
});
