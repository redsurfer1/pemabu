"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type OptionSide = "call" | "put";
type OptionStrategy = "covered_call" | "protective_put" | "cash_secured_put" | "long_call" | "long_put";

export interface OptionsPosition {
  id: string;
  user_id: string;
  portfolio_id: string;
  underlying_ticker: string;
  option_type: OptionSide;
  strategy: OptionStrategy;
  strike_price: number;
  expiration_date: string;
  contracts: number;
  premium_paid: number;
  current_price: number | null;
  delta: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface OptionsOverlayClientProps {
  portfolioId: string;
}

type CreatePositionInput = {
  portfolio_id: string;
  underlying_ticker: string;
  option_type: OptionSide;
  strategy: OptionStrategy;
  strike_price: number;
  expiration_date: string;
  contracts: number;
  premium_paid: number;
  notes: string | null;
};

const STRATEGY_LABELS: Record<OptionStrategy, string> = {
  covered_call: "Covered Call",
  protective_put: "Protective Put",
  cash_secured_put: "Cash-Secured Put",
  long_call: "Long Call",
  long_put: "Long Put",
};

const STRATEGY_DESCRIPTIONS: Record<OptionStrategy, string> = {
  covered_call: "Sell a call against shares you own. Generates premium income.",
  protective_put: "Buy a put to hedge downside on shares you own.",
  cash_secured_put: "Sell a put backed by cash. Generates premium; may result in stock purchase.",
  long_call: "Buy a call for leveraged upside exposure.",
  long_put: "Buy a put for leveraged downside exposure or portfolio hedge.",
};

function daysToExpiration(expirationDate: string): number {
  const now = new Date();
  const exp = new Date(expirationDate);
  return Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function calcPositionPnL(position: OptionsPosition): number {
  if (position.current_price === null) return 0;
  const multiplier = position.contracts * 100;
  const isSold = position.strategy === "covered_call" || position.strategy === "cash_secured_put";
  return isSold
    ? (position.premium_paid - position.current_price) * multiplier
    : (position.current_price - position.premium_paid) * multiplier;
}

function calcDeltaAdjustedExposure(position: OptionsPosition): number {
  if (position.delta === null) return 0;
  return position.delta * position.contracts * 100;
}

async function fetchPositions(portfolioId: string): Promise<OptionsPosition[]> {
  const res = await fetch(`/api/options/positions?portfolio_id=${encodeURIComponent(portfolioId)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to fetch options positions");
  const data = (await res.json()) as { positions: OptionsPosition[] };
  return data.positions;
}

async function createPosition(payload: CreatePositionInput): Promise<OptionsPosition> {
  const res = await fetch("/api/options/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create options position");
  const data = (await res.json()) as { position: OptionsPosition };
  return data.position;
}

async function deletePosition(id: string): Promise<void> {
  const res = await fetch(`/api/options/positions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to delete options position");
}

export function OptionsOverlayClient({ portfolioId }: OptionsOverlayClientProps) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    underlying_ticker: "",
    option_type: "call" as OptionSide,
    strategy: "covered_call" as OptionStrategy,
    strike_price: "",
    expiration_date: "",
    contracts: "1",
    premium_paid: "",
    notes: "",
  });

  const { data: positions = [], isPending } = useQuery({
    queryKey: ["options", "positions", portfolioId],
    queryFn: () => fetchPositions(portfolioId),
    enabled: Boolean(portfolioId),
    staleTime: 60 * 1000,
  });

  const { mutate: addPosition, isPending: isAdding } = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["options", "positions", portfolioId] });
      setShowAddForm(false);
      setForm({
        underlying_ticker: "",
        option_type: "call",
        strategy: "covered_call",
        strike_price: "",
        expiration_date: "",
        contracts: "1",
        premium_paid: "",
        notes: "",
      });
    },
  });

  const { mutate: removePosition } = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["options", "positions", portfolioId] }),
  });

  if (!portfolioId) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center text-sm text-amber-100">
        Select a portfolio (add <span className="font-mono">?portfolio_id=…</span> to the URL) or open Options from a
        portfolio context.
      </div>
    );
  }

  const totalPnL = positions.reduce((sum, p) => sum + calcPositionPnL(p), 0);
  const totalDeltaExposure = positions.reduce((sum, p) => sum + calcDeltaAdjustedExposure(p), 0);
  const expiringThisWeek = positions.filter((p) => daysToExpiration(p.expiration_date) <= 7).length;

  function handleSubmit() {
    if (!form.underlying_ticker || !form.strike_price || !form.expiration_date || !form.premium_paid) return;
    const payload: CreatePositionInput = {
      portfolio_id: portfolioId,
      underlying_ticker: form.underlying_ticker.toUpperCase().trim(),
      option_type: form.option_type,
      strategy: form.strategy,
      strike_price: parseFloat(form.strike_price),
      expiration_date: form.expiration_date,
      contracts: parseInt(form.contracts, 10),
      premium_paid: parseFloat(form.premium_paid),
      notes: form.notes.trim() || null,
    };
    addPosition(payload);
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-gray-500">Loading positions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-white">Options Overlay</h1>
          <p className="mt-1 text-xs text-gray-500">
            Track options positions alongside your core portfolio. Delta-adjusted exposure is calculated per position.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-white/20"
        >
          {showAddForm ? "Cancel" : "+ Add Position"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total P&L",
            value: `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`,
            color: totalPnL >= 0 ? "text-emerald-400" : "text-red-400",
          },
          { label: "Delta Exposure (shares)", value: totalDeltaExposure.toFixed(0), color: "text-white" },
          {
            label: "Expiring ≤ 7 days",
            value: String(expiringThisWeek),
            color: expiringThisWeek > 0 ? "text-amber-400" : "text-gray-400",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`mt-1 text-xl font-medium tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <p className="mb-4 text-sm font-medium text-white">Add Options Position</p>
          <div className="mb-4">
            <label className="mb-2 block text-xs text-gray-500">Strategy</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {(Object.keys(STRATEGY_LABELS) as OptionStrategy[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      strategy: s,
                      option_type:
                        s === "covered_call" || s === "cash_secured_put"
                          ? "call"
                          : s === "protective_put" || s === "long_put"
                            ? "put"
                            : "call",
                    }))
                  }
                  className={`rounded border px-2 py-2 text-left text-xs transition-colors ${
                    form.strategy === s
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                      : "border-white/10 text-gray-500 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <p className="font-medium">{STRATEGY_LABELS[s]}</p>
                  <p className="mt-0.5 text-[10px] leading-tight opacity-70">{STRATEGY_DESCRIPTIONS[s]}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Underlying", field: "underlying_ticker" as const, placeholder: "AAPL", type: "text" as const },
              { label: "Strike ($)", field: "strike_price" as const, placeholder: "150.00", type: "number" as const },
              { label: "Expiration", field: "expiration_date" as const, placeholder: "", type: "date" as const },
              { label: "Contracts", field: "contracts" as const, placeholder: "1", type: "number" as const },
              {
                label: "Premium / share ($)",
                field: "premium_paid" as const,
                placeholder: "2.50",
                type: "number" as const,
              },
              { label: "Notes", field: "notes" as const, placeholder: "Optional", type: "text" as const },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-gray-500">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isAdding}
            className="mt-4 rounded-lg bg-emerald-500 px-6 py-2 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {isAdding ? "Adding…" : "Add Position"}
          </button>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <p className="text-sm text-gray-500">No options positions tracked yet.</p>
          <p className="mt-1 text-xs text-gray-600">Add your first position to see P&L and delta exposure.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-xs text-gray-500">
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Strategy</th>
                <th className="px-4 py-3 text-right">Strike</th>
                <th className="px-4 py-3 text-right">Expiration</th>
                <th className="px-4 py-3 text-right">DTE</th>
                <th className="px-4 py-3 text-right">Contracts</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-right">Δ Exposure</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, i) => {
                const dte = daysToExpiration(pos.expiration_date);
                const pnl = calcPositionPnL(pos);
                const dexp = calcDeltaAdjustedExposure(pos);
                return (
                  <tr
                    key={pos.id}
                    className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""} ${
                      dte <= 7 ? "border-l-2 border-l-amber-400/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white">{pos.underlying_ticker}</td>
                    <td className="px-4 py-3 text-xs text-gray-300">{STRATEGY_LABELS[pos.strategy]}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">${pos.strike_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-300">{pos.expiration_date}</td>
                    <td className={`px-4 py-3 text-right text-xs ${dte <= 7 ? "text-amber-400" : "text-gray-400"}`}>
                      {dte}d
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-300">{pos.contracts}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-300">{dexp.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removePosition(pos.id)}
                        className="text-xs text-gray-600 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        Not a registered investment advisor. Options positions are tracked for informational purposes only.
      </p>
    </div>
  );
}
