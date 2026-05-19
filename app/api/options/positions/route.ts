import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { READ_RATE_LIMIT, MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

const ADDON = "addon_options_overlay";

const PositionSchema = z.object({
  portfolio_id: z.string().uuid(),
  underlying_ticker: z.string().min(1).max(10),
  option_type: z.enum(["call", "put"]),
  strategy: z.enum([
    "covered_call",
    "protective_put",
    "cash_secured_put",
    "long_call",
    "long_put",
  ]),
  strike_price: z.number().positive(),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contracts: z.number().int().positive(),
  premium_paid: z.number().positive(),
  notes: z.string().nullable().optional(),
});

async function assertPortfolioOwner(userId: string, portfolioId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, ADDON);

  const portfolioId = new URL(req.url).searchParams.get("portfolio_id");
  if (!portfolioId) return NextResponse.json({ error: "portfolio_id required" }, { status: 400 });

  if (!(await assertPortfolioOwner(user.id, portfolioId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("options_positions")
    .select("*")
    .eq("user_id", user.id)
    .eq("portfolio_id", portfolioId)
    .order("expiration_date", { ascending: true });

  if (error) throw error;
  return NextResponse.json({ positions: data ?? [] });
}, { keyTemplate: "options:{userId}", ...READ_RATE_LIMIT });

export const POST = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, ADDON);

  const body: unknown = await req.json();
  const parsed = PositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await assertPortfolioOwner(user.id, parsed.data.portfolio_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("options_positions")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ position: data }, { status: 201 });
}, { keyTemplate: "options:{userId}", ...MUTATION_RATE_LIMIT });
