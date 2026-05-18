"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Assumptions } from "@/lib/portfolio/formula-engine";
import { DEFAULT_ASSUMPTIONS, colAB, colAK, normaliseWeights } from "@/lib/portfolio/formula-engine";
import { normaliseFactorWeights } from "@/lib/portfolio/portfolio-factors";
import type { AssetClass } from "@/lib/types/database";
import { errorMessageFromResponseBody, getErrorMessage } from "@/lib/api/error-message";
import { parseRowStatus, ROW_STATUS, type RowStatus } from "@/lib/portfolio/fiat-watchlist";

export interface ComputedRow {
  id: string;
  portfolio_id: string;
  rowStatus: RowStatus;
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
  sub_rank_thirteen_f: number | null;
  sub_rank_macro_intelligence: number | null;
  sub_rank_governance_layer: number | null;
  sub_rank_political_tracker: number | null;
  sub_rank_token_quality: number | null;
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

function pickNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapHoldingToComputedRow(row: Record<string, unknown>): ComputedRow {
  const symbol = String(row.ticker ?? row.symbol ?? "");
  const quantity = Number(row.quantity ?? 0);
  const isCash = symbol === "CASH" || row.asset_class === "cash";
  const price_current =
    pickNum(row.price_current) ?? pickNum(row.current_price) ?? (isCash ? 1 : null);
  const market_value =
    pickNum(row.market_value) ??
    (price_current != null && quantity > 0 ? quantity * price_current : null);
  const targetWt = pickNum(row.target_parity_weight) ?? pickNum(row.target_weight_pct);

  return {
    id: String(row.id),
    portfolio_id: String(row.portfolio_id),
    rowStatus: parseRowStatus(row.row_status),
    symbol,
    name: String(row.name ?? symbol),
    quantity,
    expense_ratio: pickNum(row.expense_ratio),
    dividend_dollars: pickNum(row.dividend_dollars),
    target_parity_weight: targetWt,
    price_current,
    price_24h_basis: pickNum(row.price_24h_basis),
    price_7d_basis: pickNum(row.price_7d_basis),
    basis_price_3mo: pickNum(row.basis_price_3mo),
    basis_price_6mo: pickNum(row.basis_price_6mo),
    basis_price_1yr: pickNum(row.basis_price_1yr),
    basis_price_3yr: pickNum(row.basis_price_3yr),
    basis_price_5yr: pickNum(row.basis_price_5yr),
    volatility_3mo: pickNum(row.volatility_3mo),
    rsi_14: pickNum(row.rsi_14),
    last_market_refresh:
      (row.last_market_refresh as string | null) ??
      (row.last_price_refreshed_at as string | null) ??
      null,
    market_value,
    current_weight: pickNum(row.current_weight),
    div_apy: pickNum(row.div_apy),
    change_24h:
      pickNum(row.change_24h) ??
      (pickNum(row.last_change_pct) != null ? pickNum(row.last_change_pct)! / 100 : null),
    change_7d: pickNum(row.change_7d),
    return_3mo: pickNum(row.return_3mo),
    return_6mo: pickNum(row.return_6mo),
    return_1yr: pickNum(row.return_1yr),
    return_3yr: pickNum(row.return_3yr),
    return_5yr: pickNum(row.return_5yr),
    return_avg: pickNum(row.return_avg),
    return_weighted_avg: pickNum(row.return_weighted_avg),
    volatility_abs: pickNum(row.volatility_abs) ?? pickNum(row.volatility_3mo),
    volatility_signed: pickNum(row.volatility_signed),
    sub_rank_current: pickNum(row.sub_rank_current),
    sub_rank_expense: pickNum(row.sub_rank_expense),
    sub_rank_weighted_ret: pickNum(row.sub_rank_weighted_ret),
    sub_rank_div_apy: pickNum(row.sub_rank_div_apy),
    sub_rank_volatility: pickNum(row.sub_rank_volatility),
    sub_rank_thirteen_f: pickNum(row.sub_rank_thirteen_f),
    sub_rank_macro_intelligence: pickNum(row.sub_rank_macro_intelligence),
    sub_rank_governance_layer: pickNum(row.sub_rank_governance_layer),
    sub_rank_political_tracker: pickNum(row.sub_rank_political_tracker),
    sub_rank_token_quality: pickNum(row.sub_rank_token_quality),
    composite_score: pickNum(row.composite_score),
    rank_overall: pickNum(row.rank_overall),
    alert_primary: (row.alert_primary as string | null) ?? null,
    alert_secondary: (row.alert_secondary as string | null) ?? null,
    target_sleeve_pct: pickNum(row.target_sleeve_pct) ?? targetWt,
    parity_dollars: pickNum(row.parity_dollars),
    parity_change_dollars: pickNum(row.parity_change_dollars),
    shares_delta: pickNum(row.shares_delta),
  };
}

function needsEngineMetricsRefresh(rows: ComputedRow[]): boolean {
  if (rows.length === 0) return false;
  return rows.some(
    (r) =>
      r.last_market_refresh == null &&
      (r.return_3mo == null || r.rsi_14 == null || r.rank_overall == null),
  );
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
    sub_rank_thirteen_f: row.sub_rank_thirteen_f,
    sub_rank_macro_intelligence: row.sub_rank_macro_intelligence,
    sub_rank_governance_layer: row.sub_rank_governance_layer,
    sub_rank_political_tracker: row.sub_rank_political_tracker,
    sub_rank_token_quality: row.sub_rank_token_quality,
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

  const fetchGenerationRef = useRef(0);

  const fetchRows = useCallback(async (generation: number): Promise<boolean> => {
    if (!portfolioId) return false;
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const [holdingsRes, assumptionsRes] = await Promise.all([
        fetch(`/api/workbook/holdings?portfolioId=${encodeURIComponent(portfolioId)}`, {
          credentials: "same-origin",
        }),
        fetch(`/api/workbook/assumptions?portfolioId=${encodeURIComponent(portfolioId)}`, {
          credentials: "same-origin",
        }),
      ]);

      const body = (await holdingsRes.json()) as { holdings?: Record<string, unknown>[]; error?: unknown };
      if (!holdingsRes.ok) {
        throw new Error(errorMessageFromResponseBody(body, "Failed to load holdings"));
      }

      const assumptionsBody = (await assumptionsRes.json()) as {
        assumptions?: Assumptions;
        error?: string;
      };
      const loadedAssumptions = assumptionsRes.ok
        ? assumptionsBody.assumptions
        : undefined;
      if (!assumptionsRes.ok) {
        console.warn(
          "Assumptions API unavailable, using defaults:",
          assumptionsBody.error ?? assumptionsRes.status,
        );
      }

      let rows = (body.holdings ?? []).map(mapHoldingToComputedRow);
      const derivedTotalMv = rows.reduce((sum, r) => sum + (r.market_value ?? 0), 0);
      if (derivedTotalMv > 0) {
        rows = rows.map((r) => ({
          ...r,
          current_weight:
            r.current_weight ??
            (r.market_value != null ? r.market_value / derivedTotalMv : null),
        }));
      }
      if (generation !== fetchGenerationRef.current) return false;
      setComputed(rows);

      if (loadedAssumptions && generation === fetchGenerationRef.current) {
        setAssumptions(loadedAssumptions);
      }

      const newest = rows
        .map((r) => r.last_market_refresh)
        .filter((v): v is string => !!v)
        .sort()
        .at(-1);
      if (generation === fetchGenerationRef.current) {
        setLastRefreshed(newest ?? null);
      }
      return generation === fetchGenerationRef.current;
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

    const generation = ++fetchGenerationRef.current;
    void (async () => {
      const ok = await fetchRows(generation);
      if (cancelled || generation !== fetchGenerationRef.current) return;
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

  const autoRefreshKeyRef = useRef<string | null>(null);

  const refreshSignals = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/refresh`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        success?: boolean;
        refreshedAt?: string;
        queued?: boolean;
        reason?: string;
        error?: unknown;
      };

      if (res.status === 202 && body.queued) {
        await fetchRows(++fetchGenerationRef.current);
        return;
      }

      if (!res.ok) {
        throw new Error(errorMessageFromResponseBody(body, "Refresh failed"));
      }

      setLastRefreshed(body.refreshedAt ?? new Date().toISOString());
      await fetchRows(++fetchGenerationRef.current);
    } catch (e) {
      setError(getErrorMessage(e, "Refresh failed"));
    } finally {
      setLoading(false);
    }
  }, [fetchRows, portfolioId]);

  useEffect(() => {
    if (!portfolioId || loading) return;
    if (computed.length === 0) return;
    if (!needsEngineMetricsRefresh(computed)) return;
    const key = `${portfolioId}:${computed.map((r) => r.id).join(",")}`;
    if (autoRefreshKeyRef.current === key) return;
    autoRefreshKeyRef.current = key;
    void refreshSignals();
  }, [portfolioId, computed, loading, refreshSignals]);

  const addHolding = useCallback(
    async (payload: HoldingInsert) => {
      const assetClass = payload.asset_class ?? "equity";
      const ticker = assetClass === "cash" ? "CASH" : payload.symbol.toUpperCase();
      const rowStatus =
        payload.quantity > 0 ? ROW_STATUS.ACTIVE : ROW_STATUS.WATCH;
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
          row_status: rowStatus,
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

  const addToWatchlist = useCallback(
    async (ticker: string) => {
      if (!portfolioId) return;
      const symbol = ticker.trim().toUpperCase();
      if (!symbol) return;
      const res = await fetch("/api/workbook/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ portfolio_id: portfolioId, ticker: symbol }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Add to watchlist failed");
      await fetchRows(++fetchGenerationRef.current);
      await refreshSignals();
    },
    [fetchRows, portfolioId, refreshSignals],
  );

  const removeFromWatchlist = useCallback(
    async (ticker: string) => {
      if (!portfolioId) return;
      const res = await fetch(
        `/api/workbook/watchlist/${encodeURIComponent(ticker)}?portfolioId=${encodeURIComponent(portfolioId)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Remove from watchlist failed");
      await fetchRows(++fetchGenerationRef.current);
    },
    [fetchRows, portfolioId],
  );

  const removeHolding = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/workbook/holdings/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed");
      await fetchRows(++fetchGenerationRef.current);
    },
    [fetchRows],
  );

  const updateAssumptions = useCallback(
    async (a: Assumptions) => {
      const appliedAssumptions: Assumptions = {
        ...a,
        return_weights: normaliseWeights(a.return_weights),
        factor_weights: normaliseFactorWeights(a.factor_weights),
      };
      const res = await fetch("/api/workbook/assumptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          portfolioId,
          return_weights: appliedAssumptions.return_weights,
          factor_weights: appliedAssumptions.factor_weights,
        }),
      });
      const saveBody = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(saveBody.error ?? "Failed to save assumptions");

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
            {
              pctWeight: Number(r.sub_rank_current ?? 0),
              thirteenF: Number(r.sub_rank_thirteen_f ?? 0),
              macroIntelligence: Number(r.sub_rank_macro_intelligence ?? 0),
              governanceLayer: Number(r.sub_rank_governance_layer ?? 0),
              politicalTracker: Number(r.sub_rank_political_tracker ?? 0),
              tokenQuality: Number(r.sub_rank_token_quality ?? 0),
            },
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
    addToWatchlist,
    removeFromWatchlist,
    updateAssumptions,
  };
}
