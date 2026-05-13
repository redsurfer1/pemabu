import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

const ADDON = "addon_defi_onchain";
const SUPPORTED_CHAINS = ["ethereum", "bitcoin", "solana", "base", "arbitrum", "polygon"] as const;

const WalletSchema = z.object({
  address: z.string().min(10).max(128),
  chain: z.enum(SUPPORTED_CHAINS),
  label: z.string().max(60).optional(),
});

async function assertAddon(userId: string): Promise<NextResponse | null> {
  const keys = await getActiveServiceKeysForUser(userId);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export const GET = withAuth(async (_req, user) => {
  const denied = await assertAddon(user.id);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("defi_wallets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return NextResponse.json({ wallets: data ?? [] });
});

export const POST = withAuth(async (req, user) => {
  const denied = await assertAddon(user.id);
  if (denied) return denied;

  const body: unknown = await req.json();
  const parsed = WalletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("defi_wallets")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ wallet: data }, { status: 201 });
});
