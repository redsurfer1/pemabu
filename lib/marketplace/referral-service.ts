import { supabaseAdmin } from "@/lib/supabase/admin";
import { creditTokensFromStripe } from "./import-token-service";

const REFERRAL_CODE_PREFIX = "PEMABU";
const REFERRER_REWARD_TOKENS = 1;
const REFEREE_REWARD_TOKENS = 1;

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.code) return existing.code;

  const code = await generateUniqueCode();

  const { data, error } = await supabaseAdmin
    .from("referral_codes")
    .insert({ user_id: userId, code })
    .select("code")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: race } = await supabaseAdmin
        .from("referral_codes")
        .select("code")
        .eq("user_id", userId)
        .single();
      if (race?.code) return race.code;
    }
    throw new Error(`Failed to create referral code: ${error.message}`);
  }

  return data.code;
}

export async function resolveReferralCode(code: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("referral_codes")
    .select("user_id")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  return data?.user_id ?? null;
}

export async function processReferralReward(params: {
  referrerUserId: string;
  refereeUserId: string;
  stripeSessionId: string;
}): Promise<{ rewarded: boolean; reason?: string }> {
  if (params.referrerUserId === params.refereeUserId) {
    return { rewarded: false, reason: "self_referral" };
  }

  const { data: existingAsReferee } = await supabaseAdmin
    .from("referral_events")
    .select("id")
    .eq("referee_user_id", params.refereeUserId)
    .maybeSingle();

  if (existingAsReferee) {
    return { rewarded: false, reason: "referee_already_rewarded" };
  }

  const { error: insertError } = await supabaseAdmin.from("referral_events").insert({
    referrer_user_id: params.referrerUserId,
    referee_user_id: params.refereeUserId,
    stripe_session_id: params.stripeSessionId,
    referrer_credits: REFERRER_REWARD_TOKENS,
    referee_credits: REFEREE_REWARD_TOKENS,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { rewarded: false, reason: "already_rewarded" };
    }
    throw new Error(`Referral event insert failed: ${insertError.message}`);
  }

  await creditTokensFromStripe({
    userId: params.referrerUserId,
    stripeSessionId: `referral-referrer-${params.stripeSessionId}`,
    quantity: REFERRER_REWARD_TOKENS,
    amountUsdCents: 0,
    isComplimentary: true,
  });

  await creditTokensFromStripe({
    userId: params.refereeUserId,
    stripeSessionId: `referral-referee-${params.stripeSessionId}`,
    quantity: REFEREE_REWARD_TOKENS,
    amountUsdCents: 0,
    isComplimentary: true,
  });

  const { data: stats } = await supabaseAdmin
    .from("referral_codes")
    .select("total_referrals, total_credits_earned")
    .eq("user_id", params.referrerUserId)
    .single();

  await supabaseAdmin
    .from("referral_codes")
    .update({
      total_referrals: (stats?.total_referrals ?? 0) + 1,
      total_credits_earned: (stats?.total_credits_earned ?? 0) + REFERRER_REWARD_TOKENS,
    })
    .eq("user_id", params.referrerUserId);

  return { rewarded: true };
}

async function generateUniqueCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const digits = "0123456789";

  for (let attempts = 0; attempts < 10; attempts++) {
    const letters = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const nums = Array.from({ length: 2 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
    const code = `${REFERRAL_CODE_PREFIX}-${letters}${nums}`;

    const { data } = await supabaseAdmin.from("referral_codes").select("code").eq("code", code).maybeSingle();
    if (!data) return code;
  }

  throw new Error("Failed to generate unique referral code after 10 attempts");
}
