import { createClient } from "@/lib/supabase/server";

/** Fallback admin check (not used by API routes when middleware gates /api/admin). */
export async function verifyAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}
