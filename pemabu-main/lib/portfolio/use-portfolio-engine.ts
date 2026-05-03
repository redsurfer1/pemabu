"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Assumptions } from "@/lib/portfolio/formula-engine";
import { DEFAULT_ASSUMPTIONS, colAB, colAK, normaliseWeights } from "@/lib/portfolio/formula-engine";
import type { AssetClass } from "@/lib/types/database";

export interface ComputedRow {
  id: string;
  portfolio_id: string;
  rowStatus: "Active" | "Comparable";
  symbol: string;
  name: string;
  quantity: number;
  expense_ratio: number | null;
  dividend_dollars: number | null;
  target_parity_weight: number | null;
  price_current: number | null;
  price_24h_basis: number | null;
  price_7d_basis: number | null;
  basis_price_3mo: number | null;
  basis_price_6mo: number | null;
  basis_price_1yr: number | null;
  basis_price_3yr: number | null;
  basis_price_5yr: number | null;
  volatility_3mo: number | null;
  rsi_14: number | null;
  last_market_refresh: string | null;
  market_value: number | null;
  current_weight: number | null;
  div_apy: number | null;
  change_24h: number | null;
  change_7d: number | null;
  return_3mo: number | null;
  return_6mo: number | null;
  return_1yr: number | null;
  return_3yr: number | null;
  return_5yr: number | null;
  return_avg: number | null;
  return_weighted_avg: number | null;
  volatility_abs: number | null;
  volatility_signed: number | null;
  sub_rank_current: number | null;
  sub_rank_expense: number | null;
  sub_rank_weighted_ret: number | null;
  sub_rank_div_apy: number | null;
  sub_rank_volatility: number | null;
  composite_score: number | null;
  rank_overall: number | null;
  alert_primary: string | null;
  alert_secondary: string | null;
  target_sleeve_pct: number | null;
  parity_dollars: number | null;
  parity_change_dollars: number | null;
  shares_delta: number | null;
}

type HoldingInsert = {
  symbol: string;
  quantity: number;
  name?: string;
  asset_class?: AssetClass;
  expense_ratio?: number | null;
  target_parity_weight?: number | null;
};

export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected";

function mapHoldingToComputedRow(row: Record<string, unknown>): ComputedRow {
  return {
    id: String(row.id),
    portfolio_id: String(row.portfolio_id),
    rowStatus: "Active",
    symbol: String(row.ticker ?? row.symbol ?? ""),
    name: String(row.name ?? row.ticker ?? ""),
    quantity: Number(row.quantity ?? 0),
    expense_ratio: (row.expense_ratio as number | null) ?? null,
    dividend_dollars: (row.dividend_dollars as number | null) ?? null,
    target_parity_weight: (row.target_parity_weight as number | null) ?? null,
    price_current: (row.price_current as number | null) ?? null,
    price_24h_basis: (row.price_24h_basis as number | null) ?? null,
    price_7d_basis: (row.price_7d_basis as number | null) ?? null,
    basis_price_3mo: (row.basis_price_3mo as number | null) ?? null,
    basis_price_6mo: (row.basis_price_6mo as number | null) ?? null,
    basis_price_1yr: (row.basis_price_1yr as number | null) ?? null,
    basis_price_3yr: (row.basis_price_3yr as number | null) ?? null,
    basis_price_5yr: (row.basis_price_5yr as number | null) ?? null,
    volatility_3mo: (row.volatility_3mo as number | null) ?? null,
    rsi_14: (row.rsi_14 as number | null) ?? null,
    last_market_refresh: (row.last_market_refresh as string | null) ?? null,
    market_value: (row.market_value as number | null) ?? null,
    current_weight: (row.current_weight as number | null) ?? null,
    div_apy: (row.div_apy as number | null) ?? null,
    change_24h: (row.change_24h as number | null) ?? null,
    change_7d: (row.change_7d as number | null) ?? null,
    return_3mo: (row.return_3mo as number | null) ?? null,
    return_6mo: (row.return_6mo as number | null) ?? null,
    return_1yr: (row.return_1yr as number | null) ?? null,
    return_3yr: (row.return_3yr as number | null) ?? null,
    return_5yr: (row.return_5yr as number | null) ?? null,
    return_avg: (row.return_avg as number | null) ?? null,
    return_weighted_avg: (row.return_weighted_avg as number | null) ?? null,
    volatility_abs: (row.volatility_abs as number | null) ?? null,
    volatility_signed: (row.volatility_signed as number | null) ?? null,
    sub_rank_current: (row.sub_rank_current as number | null) ?? null,
    sub_rank_expense: (row.sub_rank_expense as number | null) ?? null,
    sub_rank_weighted_ret: (row.sub_rank_weighted_ret as number | null) ?? null,
    sub_rank_div_apy: (row.sub_rank_div_apy as number | null) ?? null,
    sub_rank_volatility: (row.sub_rank_volatility as number | null) ?? null,
    composite_score: (row.composite_score as number | null) ?? null,
    rank_overall: (row.rank_overall as number | null) ?? null,
    alert_primary: (row.alert_primary as string | null) ?? null,
    alert_secondary: (row.alert_secondary as string | null) ?? null,
    target_sleeve_pct: (row.target_sleeve_pct as number | null) ?? null,
    parity_dollars: (row.parity_dollars as number | null) ?? null,
    parity_change_dollars: (row.parity_change_dollars as number | null) ?? null,
    shares_delta: (row.shares_delta as number | null) ?? null,
  };
}

function computedRowToHoldingRecord(row: ComputedRow): Record<string, unknown> {
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    ticker: row.symbol,
    name: row.name,
    quantity: row.quantity,
    expense_ratio: row.expense_ratio,
    dividend_dollars: row.dividend_dollars,
    target_parity_weight: row.target_parity_weight,
    price_current: row.price_current,
    price_24h_basis: row.price_24h_basis,
    price_7d_basis: row.price_7d_basis,
    basis_price_3mo: row.basis_price_3mo,
    basis_price_6mo: row.basis_price_6mo,
    basis_price_1yr: row.basis_price_1yr,
    basis_price_3yr: row.basis_price_3yr,
    basis_price_5yr: row.basis_price_5yr,
    volatility_3mo: row.volatility_3mo,
    rsi_14: row.rsi_14,
    last_market_refresh: row.last_market_refresh,
    market_value: row.market_value,
    current_weight: row.current_weight,
    div_apy: row.div_apy,
    change_24h: row.change_24h,
    change_7d: row.change_7d,
    return_3mo: row.return_3mo,
    return_6mo: row.return_6mo,
    return_1yr: row.return_1yr,
    return_3yr: row.return_3yr,
    return_5yr: row.return_5yr,
    return_avg: row.return_avg,
    return_weighted_avg: row.return_weighted_avg,
    volatility_abs: row.volatility_abs,
    volatility_signed: row.volatility_signed,
    sub_rank_current: row.sub_rank_current,
    sub_rank_expense: row.sub_rank_expense,
    sub_rank_weighted_ret: row.sub_rank_weighted_ret,
    sub_rank_div_apy: row.sub_rank_div_apy,
    sub_rank_volatility: row.sub_rank_volatility,
    composite_score: row.composite_score,
    rank_overall: row.rank_overall,
    alert_primary: row.alert_primary,
    alert_secondary: row.alert_secondary,
    target_sleeve_pct: row.target_sleeve_pct,
    parity_dollars: row.parity_dollars,
    parity_change_dollars: row.parity_change_dollars,
    shares_delta: row.shares_delta,
  };
}

function mergeRealtimeIntoRow(row: ComputedRow, rawNew: Record<string, unknown>): ComputedRow {
  return mapHoldingToComputedRow({
    ...computedRowToHoldingRecord(row),
    ...rawNew,
  });
}

export function usePortfolioEngine(portfolioId: string) {
  const [computed, setComputed] = useState<ComputedRow[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>(() =>
    portfolioId ? "connecting" : "disconnected",
  );

  const totalMV = useMemo(
    () => computed.reduce((sum, r) => sum + Number(r.market_value ?? 0), 0),
    [computed],
  );

  const fetchRows = useCallback(async (): Promise<boolean> => {
    if (!portfolioId) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workbook/holdings?portfolioId=${encodeURIComponent(portfolioId)}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as { holdings?: Record<string, unknown>[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load holdings");
      const rows = (body.holdings ?? []).map(mapHoldingToComputedRow);
      setComputed(rows);
      const newest = rows
        .map((r) => r.last_market_refresh)
        .filter((v): v is string => !!v)
        .sort()
        .at(-1);
      setLastRefreshed(newest ?? null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (!portfolioId) {
      setRealtimeStatus("disconnected");
      return;
    }

    setRealtimeStatus("connecting");
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const handleRealtimeUpdate = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const ev = payload.eventType;
      if (ev === "INSERT" && payload.new) {
        const row = mapHoldingToComputedRow(payload.new);
        setComputed((prev) => {
          if (prev.some((r) => r.id === row.id)) return prev;
          return [...prev, row];
        });
        return;
      }
      if (ev === "UPDATE" && payload.new) {
        const id = String((payload.new as { id?: string }).id ?? "");
        setComputed((prev) =>
          prev.map((r) => (r.id === id ? mergeRealtimeIntoRow(r, payload.new as Record<string, unknown>) : r)),
        );
        return;
      }
      if (ev === "DELETE" && payload.old && (payload.old as { id?: string }).id != null) {
        const id = String((payload.old as { id: string }).id);
        setComputed((prev) => prev.filter((r) => r.id !== id));
      }
    };

    void (async () => {
      const ok = await fetchRows();
      if (cancelled) return;
      if (!ok) {
        setRealtimeStatus("disconnected");
        return;
      }

      channel = supabase
        .channel(`portfolio_holdings:${portfolioId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "portfolio_holdings",
            filter: `portfolio_id=eq.${portfolioId}`,
          },
          handleRealtimeUpdate,
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setRealtimeStatus("connected");
          else if (status === "CLOSED" || status === "CHANNEL_ERROR") setRealtimeStatus("disconnected");
          else setRealtimeStatus("connecting");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [portfolioId, fetchRows]);

  const refreshSignals = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/refresh`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = (await res.json()) as { success?: boolean; refreshedAt?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Refresh failed");
      setLastRefreshed(body.refreshedAt ?? new Date().toISOString());
      await fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchRows, portfolioId]);

  const addHolding = useCallback(
    async (payload: HoldingInsert) => {
      const assetClass = payload.asset_class ?? "equity";
      const ticker = assetClass === "cash" ? "CASH" : payload.symbol.toUpperCase();
      const res = await fetch("/api/workbook/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          portfolio_id: portfolioId,
          ticker,
          name: payload.name,
          asset_class: assetClass,
          quantity: payload.quantity,
          source: "manual",
          ...(payload.expense_ratio != null ? { expense_ratio: payload.expense_ratio } : {}),
          ...(payload.target_parity_weight != null
            ? { target_parity_weight: payload.target_parity_weight }
            : {}),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Add holding failed");
      await refreshSignals();
    },
    [portfolioId, refreshSignals],
  );

  const removeHolding = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/workbook/holdings/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed");
      await fetchRows();
    },
    [fetchRows],
  );

  const updateAssumptions = useCallback(
    async (a: Assumptions) => {
      const appliedAssumptions: Assumptions = {
        ...a,
        return_weights: normaliseWeights(a.return_weights),
      };
      const supabase = getSupabaseBrowserClient();
      const { error: upsertErr } = await supabase.from("portfolio_assumptions").upsert(
        {
          portfolio_id: portfolioId,
          weight_3mo: appliedAssumptions.return_weights.r3mo,
          weight_6mo: appliedAssumptions.return_weights.r6mo,
          weight_1yr: appliedAssumptions.return_weights.r1yr,
          weight_3yr: appliedAssumptions.return_weights.r3yr,
          weight_5yr: appliedAssumptions.return_weights.r5yr,
          factor_expense: appliedAssumptions.factor_weights.expense,
          factor_pct_weight: appliedAssumptions.factor_weights.pctWeight,
          factor_div_apy: appliedAssumptions.factor_weights.divApy,
          factor_volatility: appliedAssumptions.factor_weights.volatility,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "portfolio_id" },
      );
      if (upsertErr) throw upsertErr;

      setAssumptions(appliedAssumptions);
      setComputed((rows) =>
        rows.map((r) => {
          const wret = colAB(
            Number(r.return_3mo ?? 0),
            Number(r.return_6mo ?? 0),
            Number(r.return_1yr ?? 0),
            Number(r.return_3yr ?? 0),
            Number(r.return_5yr ?? 0),
            appliedAssumptions.return_weights,
          );
          const composite = colAK(
            Number(r.sub_rank_expense ?? 0),
            Number(r.sub_rank_weighted_ret ?? 0),
            Number(r.sub_rank_div_apy ?? 0),
            Number(r.sub_rank_volatility ?? 0),
            appliedAssumptions.factor_weights,
          );
          return {
            ...r,
            return_weighted_avg: wret,
            composite_score: composite,
          };
        }),
      );
    },
    [portfolioId],
  );

  return {
    computed,
    totalMV,
    loading,
    error,
    lastRefreshed,
    realtimeStatus,
    assumptions,
    refreshSignals,
    addHolding,
    removeHolding,
    updateAssumptions,
  };
}
