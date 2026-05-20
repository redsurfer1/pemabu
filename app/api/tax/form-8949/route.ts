import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { toRecordOrNull } from "@/lib/supabase/typed";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaxLot {
  description: string; // "N shares TICKER"
  date_acquired: string; // MM/DD/YYYY (approximate from first ADD event)
  date_sold: string; // MM/DD/YYYY
  proceeds: number; // sale proceeds USD (0 if execution price unavailable)
  cost_basis: number; // cost basis of sold portion
  gain_loss: number; // proceeds - cost_basis
  holding_period: "SHORT" | "LONG";
  ticker: string;
  proceeds_verified: boolean; // false = user must verify proceeds from broker
}

export interface TaxSummary {
  year: number;
  totalLots: number;
  shortTermLots: number;
  longTermLots: number;
  totalProceeds: number;
  totalCostBasis: number;
  totalGainLoss: number;
  shortTermGainLoss: number;
  longTermGainLoss: number;
  requiresVerification: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function holdingPeriod(acquired: string, sold: string): "SHORT" | "LONG" {
  const acq = new Date(acquired).getTime();
  const sld = new Date(sold).getTime();
  const days = (sld - acq) / (1000 * 60 * 60 * 24);
  return days >= 365 ? "LONG" : "SHORT";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (req, user) => {
  const supabase = await createClient();
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));

  // Check Autonomous tier access
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .eq("service_key", "autonomous_annual")
    .maybeSingle();

  const hasAccess =
    sub?.status === "active" ||
    sub?.status === "complimentary" ||
    sub?.status === "trial";

  if (!hasAccess) {
    return NextResponse.json(
      { error: "Tax export requires Pemabu Autonomous subscription." },
      { status: 403 },
    );
  }

  const startOfYear = `${year}-01-01T00:00:00.000Z`;
  const endOfYear = `${year}-12-31T23:59:59.999Z`;

  // ── Fetch sell events from holding_audit_log ──────────────────────────────
  // PARTIAL_SELL, FULL_EXIT, and TRADE_EXECUTION_SUCCESS events represent
  // realized position reductions with cost basis data.
  // Columns available: ticker, quantity_before, quantity_after,
  //   cost_basis_before, cost_basis_after, created_at, notes (jsonb)
  const { data: sellEvents, error: sellError } = await supabase
    .from("holding_audit_log")
    .select(
      "id, ticker, quantity_before, quantity_after, cost_basis_before, cost_basis_after, created_at, notes",
    )
    .eq("user_id", user.id)
    .in("event_type", ["PARTIAL_SELL", "FULL_EXIT", "TRADE_EXECUTION_SUCCESS"])
    .gte("created_at", startOfYear)
    .lte("created_at", endOfYear)
    .order("created_at", { ascending: true });

  if (sellError) throw sellError;

  // ── Fetch earliest ADD event per ticker to approximate acquisition date ────
  // We aggregate across all tickers found in sell events.
  const tickers = [...new Set((sellEvents ?? []).map((e) => String(e.ticker)))];

  const acquiredDateMap = new Map<string, string>();
  if (tickers.length > 0) {
    const { data: addEvents } = await supabase
      .from("holding_audit_log")
      .select("ticker, created_at")
      .eq("user_id", user.id)
      .eq("event_type", "ADD")
      .in("ticker", tickers)
      .order("created_at", { ascending: true });

    for (const ev of addEvents ?? []) {
      const t = String(ev.ticker);
      if (!acquiredDateMap.has(t)) {
        acquiredDateMap.set(t, String(ev.created_at));
      }
    }
  }

  // ── Fetch proceeds from daily_execution_logs via proposal_id in notes ─────
  // For autonomous trades, daily_execution_logs stores notional_usd (proceeds).
  const proposalIds = (sellEvents ?? [])
    .map((e) => {
      const n = toRecordOrNull(e.notes);
      return n?.proposal_id ? String(n.proposal_id) : null;
    })
    .filter((id): id is string => id !== null);

  const proceedsMap = new Map<string, number>();
  if (proposalIds.length > 0) {
    const { data: execLogs } = await supabase
      .from("daily_execution_logs")
      .select("proposal_id, notional_usd")
      .in("proposal_id", proposalIds);

    for (const log of execLogs ?? []) {
      if (log.proposal_id) {
        proceedsMap.set(String(log.proposal_id), Number(log.notional_usd ?? 0));
      }
    }
  }

  // ── Build tax lot rows ────────────────────────────────────────────────────
  const taxLots: TaxLot[] = (sellEvents ?? []).map((ev) => {
    const ticker = String(ev.ticker);
    const qBefore = Number(ev.quantity_before ?? 0);
    const qAfter = Number(ev.quantity_after ?? 0);
    const qSold = Math.max(0, qBefore - qAfter);
    const cbBefore = Number(ev.cost_basis_before ?? 0);
    const cbAfter = Number(ev.cost_basis_after ?? 0);
    const costBasis = parseFloat(Math.max(0, cbBefore - cbAfter).toFixed(2));

    // Proceeds from daily_execution_logs if this was an autonomous trade
    const notes = toRecordOrNull(ev.notes);
    const proposalId = notes?.proposal_id ? String(notes.proposal_id) : null;
    const proceeds = proposalId ? parseFloat((proceedsMap.get(proposalId) ?? 0).toFixed(2)) : 0;
    const proceedsVerified = proceeds > 0;

    const soldDate = String(ev.created_at);
    const acquiredDate = acquiredDateMap.get(ticker) ?? soldDate;

    return {
      description: `${qSold} shares ${ticker}`,
      date_acquired: fmtDate(acquiredDate),
      date_sold: fmtDate(soldDate),
      proceeds,
      cost_basis: costBasis,
      gain_loss: parseFloat((proceeds - costBasis).toFixed(2)),
      holding_period: holdingPeriod(acquiredDate, soldDate),
      ticker,
      proceeds_verified: proceedsVerified,
    };
  });

  const shortTerm = taxLots.filter((t) => t.holding_period === "SHORT");
  const longTerm = taxLots.filter((t) => t.holding_period === "LONG");
  const requiresVerification = taxLots.some((t) => !t.proceeds_verified);

  const summary: TaxSummary = {
    year,
    totalLots: taxLots.length,
    shortTermLots: shortTerm.length,
    longTermLots: longTerm.length,
    totalProceeds: parseFloat(taxLots.reduce((s, t) => s + t.proceeds, 0).toFixed(2)),
    totalCostBasis: parseFloat(taxLots.reduce((s, t) => s + t.cost_basis, 0).toFixed(2)),
    totalGainLoss: parseFloat(taxLots.reduce((s, t) => s + t.gain_loss, 0).toFixed(2)),
    shortTermGainLoss: parseFloat(shortTerm.reduce((s, t) => s + t.gain_loss, 0).toFixed(2)),
    longTermGainLoss: parseFloat(longTerm.reduce((s, t) => s + t.gain_loss, 0).toFixed(2)),
    requiresVerification,
  };

  return NextResponse.json({ taxLots, summary });
});
