import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import {
  getPortfolio,
  getPortfolioSignals,
  acknowledgeSignal,
  resolveSignal,
} from "@/lib/services/portfolio";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const GET = withAuth(async (req, user, _ctx) => {
  const url = new URL(req.url);
  const portfolioId = url.searchParams.get("portfolioId");
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;

  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }
  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const signals = await getPortfolioSignals(portfolioId, { type, status, limit });
  return NextResponse.json({ signals });
}, { keyTemplate: "signals:{userId}", ...READ_RATE_LIMIT });

const AckSchema = z.object({
  signalId: z.string().uuid(),
  action: z.enum(["acknowledge", "resolve"]),
});

export const PATCH = withAuth(async (req, user, _ctx) => {
  const body = await req.json();
  const parsed = AckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: signalRow, error: signalErr } = await supabase
    .from("signals")
    .select("id, portfolio_id")
    .eq("id", parsed.data.signalId)
    .single();

  if (signalErr || !signalRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const portfolio = await getPortfolio(signalRow.portfolio_id);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "acknowledge") {
    await acknowledgeSignal(parsed.data.signalId);
  } else {
    await resolveSignal(parsed.data.signalId);
  }
  return NextResponse.json({ success: true });
});
