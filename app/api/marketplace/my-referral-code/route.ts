import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getOrCreateReferralCode } from "@/lib/marketplace/referral-service";

export const GET = withAuth(async (_req, user, _ctx) => {
  const code = await getOrCreateReferralCode(user.id);
  return NextResponse.json({ code });
}, { keyTemplate: "referral:{userId}", ...READ_RATE_LIMIT });
