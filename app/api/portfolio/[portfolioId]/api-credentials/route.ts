import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type RouteHandlerContext } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import {
  isPortfolioApiProvider,
  PORTFOLIO_API_PROVIDERS,
  providerRequiresSecret,
} from "@/lib/portfolio/api-credentials-shared";
import {
  deletePortfolioApiCredential,
  listPortfolioApiCredentialSummaries,
  SovereignCredentialError,
  upsertPortfolioApiCredential,
} from "@/lib/portfolio/api-credentials";

const UpsertSchema = z.object({
  provider: z.enum(PORTFOLIO_API_PROVIDERS),
  apiKey: z.string().min(1).max(512),
  apiSecret: z.string().max(512).optional(),
});

async function assertPortfolioOwner(portfolioId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return supabase;
}

export const GET = withAuth(async (_req, user, ctx: RouteHandlerContext) => {
  const { portfolioId: raw } = await ctx.params;
  const portfolioId = Array.isArray(raw) ? raw[0] : raw;
  if (!portfolioId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await assertPortfolioOwner(portfolioId, user.id);
  if (!supabase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const credentials = await listPortfolioApiCredentialSummaries(supabase, portfolioId);
  return NextResponse.json({ credentials });
});

export const PUT = withAuth(async (req, user, ctx: RouteHandlerContext) => {
  const { portfolioId: raw } = await ctx.params;
  const portfolioId = Array.isArray(raw) ? raw[0] : raw;
  if (!portfolioId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await assertPortfolioOwner(portfolioId, user.id);
  if (!supabase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { provider, apiKey, apiSecret } = parsed.data;
  if (providerRequiresSecret(provider) && !apiSecret?.trim()) {
    return NextResponse.json({ error: "apiSecret is required for this provider" }, { status: 400 });
  }

  try {
    await upsertPortfolioApiCredential(supabase, {
      portfolioId,
      userId: user.id,
      provider,
      apiKey,
      apiSecret,
    });
  } catch (e) {
    if (e instanceof SovereignCredentialError) {
      return NextResponse.json({ error: e.message, code: "VAULT_REQUIRED" }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : "Failed to save credentials";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const credentials = await listPortfolioApiCredentialSummaries(supabase, portfolioId);
  return NextResponse.json({ ok: true, credentials });
});

export const DELETE = withAuth(async (req, user, ctx: RouteHandlerContext) => {
  const { portfolioId: raw } = await ctx.params;
  const portfolioId = Array.isArray(raw) ? raw[0] : raw;
  if (!portfolioId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await assertPortfolioOwner(portfolioId, user.id);
  if (!supabase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const provider = new URL(req.url).searchParams.get("provider") ?? "";
  if (!isPortfolioApiProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    await deletePortfolioApiCredential(supabase, portfolioId, provider, user.id);
  } catch (e) {
    if (e instanceof SovereignCredentialError) {
      return NextResponse.json({ error: e.message, code: "VAULT_REQUIRED" }, { status: 403 });
    }
    throw e;
  }
  const credentials = await listPortfolioApiCredentialSummaries(supabase, portfolioId);
  return NextResponse.json({ ok: true, credentials });
});
