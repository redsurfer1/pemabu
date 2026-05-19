import { withAdminAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminResponse } from "@/lib/api/response";

export const GET = withAdminAuth(async (_req, _user, _ctx) => {
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

  return adminResponse(merged);
});
