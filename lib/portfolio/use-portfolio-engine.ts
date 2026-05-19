"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Assumptions } from "@/lib/portfolio/formula-engine";
import { DEFAULT_ASSUMPTIONS, colAB, colAK, normaliseWeights } from "@/lib/portfolio/formula-engine";
import { normaliseFactorWeights } from "@/lib/portfolio/portfolio-factors";
import type { AssetClass } from "@/lib/types/database";
import { errorMessageFromResponseBody, getErrorMessage } from "@/lib/api/error-message";
import { ROW_STATUS } from "@/lib/portfolio/fiat-watchlist";
import {
  mapHoldingToComputedRow,
  mergeRealtimeIntoRow,
  needsEngineMetricsRefresh,
  type ComputedRow,
  type RealtimeConnectionStatus,
} from "@/lib/portfolio/computed-row-utils";

type HoldingInsert = {
  symbol: string;
  quantity: number;
  name?: string;
  asset_class?: AssetClass;
  expense_ratio?: number | null;
  target_parity_weight?: number | null;
};

export { type ComputedRow, type RealtimeConnectionStatus };

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
          prev.map((r) => (r.id === id ? mergeRealtimeIntoRow(r, payload.new) : r)),
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
