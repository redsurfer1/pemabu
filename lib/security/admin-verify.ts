import { isAdminUser } from "@/lib/auth/require-admin";

/** Server-side admin check against `user_profiles` via service role. */
export async function verifyAdmin(userId: string): Promise<boolean> {
  return isAdminUser(userId);
}
