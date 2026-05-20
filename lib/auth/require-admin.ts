import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Roles stored on `user_profiles.role` (validated server-side). */
export type UserProfileRole = "owner" | "admin";

export type AdminAuthDenied = {
  allowed: false;
  response: NextResponse;
};

export type AdminAuthAllowed = {
  allowed: true;
  role: "admin";
};

export type AdminAuthResult = AdminAuthDenied | AdminAuthAllowed;

/** Standard 403 when the authenticated user is not an admin operator. */
export const ADMIN_FORBIDDEN_RESPONSE = NextResponse.json(
  { error: "Unauthorized" },
  { status: 403 },
);

/**
 * Loads `user_profiles.role` via the service-role client.
 * Never trusts JWT `user_metadata` or other user-controlled claims.
 */
export async function fetchUserRoleFromDatabase(
  userId: string,
): Promise<UserProfileRole | null> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[requireAdmin] role lookup failed:", error.message);
    return null;
  }

  const role = (data as { role?: string } | null)?.role;
  if (role === "admin" || role === "owner") {
    return role;
  }
  return null;
}

/** Returns true when the user has the `admin` role in `user_profiles`. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const role = await fetchUserRoleFromDatabase(userId);
  return role === "admin";
}

/**
 * Authorizes an admin-only route handler.
 * Returns a 403 response when the user is not an admin; otherwise `{ allowed: true }`.
 */
export async function requireAdmin(user: User): Promise<AdminAuthResult> {
  const role = await fetchUserRoleFromDatabase(user.id);
  if (role !== "admin") {
    return { allowed: false, response: ADMIN_FORBIDDEN_RESPONSE };
  }
  return { allowed: true, role: "admin" };
}
