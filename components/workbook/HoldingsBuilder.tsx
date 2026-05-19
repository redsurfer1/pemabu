"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  usePortfolioHoldings,
  useUpsertHolding,
  useUpdateHolding,
  useDeleteHolding,
} from "@/hooks/usePortfolios";
import type { AssetClass, Holding } from "@/lib/types/database";
import {
  calculateHoldingDrift,
  calculateHoldingWeights,
  type Quote,
} from "@/lib/allocation/engine";
import { PortfolioApiSettings } from "@/components/workbook/PortfolioApiSettings";
import { ASSET_CLASSES } from "@/lib/constants/asset-classes";

function quotesMapFromHoldings(holdings: Holding[]): Map<string, Quote> {
  const m = new Map<string, Quote>();
  for (const h of holdings) {
    if (h.current_price == null) continue;
    m.set(h.ticker, {
      ticker: h.ticker,
      price: Number(h.current_price),
      currency: h.currency,
      asOf: new Date(),
      source: "holding",
    });
  }
  return m;
}

function formatExpenseDisplay(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(Number(ratio))) return "—";
  const pct = Number(ratio) * 100;
  return `${pct.toFixed(3).replace(/\.?0+$/, "")}%`;
}

function expenseRatioToFormInput(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(Number(ratio))) return "";
  return String(Math.round(Number(ratio) * 10000) / 100);
}

function changePctClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "text-gray-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-gray-400";
}

function driftClass(drift: number | null, hasTarget: boolean): string {
  if (!hasTarget || drift == null || !Number.isFinite(drift)) return "text-gray-500";
  const a = Math.abs(drift);
  if (a > 10) return "text-red-400";
  if (a > 5) return "text-amber-400";
  if (a <= 2) return "text-emerald-400";
  return "text-gray-300";
}

interface HoldingsBuilderProps {
  portfolioId: string;
  /** Portfolio row currency (must match API enum). */
  currency?: "USD" | "GBP" | "EUR" | "CAD" | "AUD";
}

export function HoldingsBuilder({ portfolioId, currency = "USD" }: HoldingsBuilderProps) {
  const { data: holdings = [], isLoading } = usePortfolioHoldings(portfolioId);
  const { mutateAsync: upsert, isPending } = useUpsertHolding();
  const { mutateAsync: updateHolding, isPending: isUpdating } = useUpdateHolding();
  const { mutateAsync: deleteHolding, isPending: isDeleting } = useDeleteHolding();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    asset_class: "equity" as AssetClass,
    quantity: "",
    cost_basis: "",
    expense_ratio: "",
    target_weight_pct: "",
  });

  const [form, setForm] = useState({
    ticker: "",
    name: "",
    asset_class: "equity" as AssetClass,
    quantity: "",
    cost_basis: "",
    expense_pct: "",
    target_pct: "",
  });

  const quotesMap = useMemo(() => {
    const m = quotesMapFromHoldings(holdings);
    for (const h of holdings) {
      if (h.asset_class === "cash") {
        m.set(h.ticker, {
          ticker: h.ticker,
          price: 1.00,
          currency: "USD",
          asOf: new Date(),
          source: "fixed",
        });
      }
    }
    return m;
  }, [holdings]);

  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const q = quotesMap.get(h.ticker);
      const price = h.asset_class === "cash" ? 1.00 : (q?.price ?? Number(h.current_price ?? 0));
      return sum + Number(h.quantity) * price;
    }, 0);
  }, [holdings, quotesMap]);

  const holdingWeights = useMemo(
    () => calculateHoldingWeights(holdings, quotesMap),
    [holdings, quotesMap],
  );
  const holdingDrifts = useMemo(
    () => calculateHoldingDrift(holdingWeights, holdings),
    [holdingWeights, holdings],
  );
  const driftById = useMemo(
    () => new Map(holdingDrifts.map((d) => [d.holding_id, d])),
    [holdingDrifts],
  );

  function beginEdit(h: Holding) {
    setDeletingId(null);
    setEditingId(h.id);
    setEditForm({
      name: h.name ?? "",
      asset_class: h.asset_class,
      quantity: String(h.quantity),
      cost_basis: h.cost_basis != null ? String(h.cost_basis) : "",
      expense_ratio: expenseRatioToFormInput(h.expense_ratio),
      target_weight_pct:
        h.target_weight_pct != null && Number.isFinite(Number(h.target_weight_pct))
          ? String(h.target_weight_pct)
          : "",
    });
  }

  async function handleSaveEdit(h: Holding) {
    if (!editForm.quantity.trim()) return;
    const expenseRaw = editForm.expense_ratio.trim();
    const expense_ratio =
      expenseRaw === "" ? null : Number.isFinite(Number(expenseRaw)) ? Number(expenseRaw) / 100 : null;
    const targetRaw = editForm.target_weight_pct.trim();
    const target_weight_pct =
      targetRaw === "" ? null : Number.isFinite(Number(targetRaw)) ? Number(targetRaw) : null;
    const costRaw = editForm.cost_basis.trim();
    const cost_basis =
      costRaw === "" ? null : Number.isFinite(Number(costRaw)) ? Number(costRaw) : null;

    await updateHolding({
      holdingId: h.id,
      portfolioId: h.portfolio_id,
      data: {
        name: editForm.name.trim() || null,
        asset_class: editForm.asset_class,
        quantity: Number(editForm.quantity),
        cost_basis,
        expense_ratio,
        target_weight_pct,
      },
    });
    setEditingId(null);
  }

  async function handleAdd() {
    if ((!form.ticker && form.asset_class !== "cash") || !form.quantity) return;
    const expensePctRaw = form.expense_pct.trim();
    const expense_ratio =
      expensePctRaw !== "" && Number.isFinite(Number(expensePctRaw))
        ? Number(expensePctRaw) / 100
        : undefined;
    const targetRaw = form.target_pct.trim();
    const target_weight_pct =
      targetRaw !== "" && Number.isFinite(Number(targetRaw)) ? Number(targetRaw) : undefined;

    const ticker = form.asset_class === "cash" ? "CASH" : form.ticker.toUpperCase();

    try {
      await upsert({
        portfolio_id: portfolioId,
        ticker,
        name: form.name || undefined,
        asset_class: form.asset_class,
        quantity: Number(form.quantity),
        cost_basis: form.cost_basis ? Number(form.cost_basis) : undefined,
        currency,
        source: "manual",
        ...(expense_ratio !== undefined ? { expense_ratio } : {}),
        ...(target_weight_pct !== undefined ? { target_weight_pct } : {}),
      });
      setForm({
        ticker: "",
        name: "",
        asset_class: "equity",
        quantity: "",
        cost_basis: "",
        expense_pct: "",
        target_pct: "",
      });
      setAdding(false);
    } catch (err) {
      console.error("Failed to add holding:", err);
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-400">Loading holdings...</div>;
  }

  return (
    <div className="space-y-3">
      <PortfolioApiSettings portfolioId={portfolioId} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Holdings ({holdings.length})</h3>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDeletingId(null);
            setAdding(true);
          }}
          className="text-xs text-emerald-400 transition-colors hover:text-emerald-300"
        >
          + Add holding
        </button>
      </div>

      {holdings.length > 0 && (
        <div className="overflow-x-auto">
          {/* 8-column holdings table: Ticker · Name · Qty · Value · Wt% · 1d% · Target/Δ · Actions */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-500">
                <th className="pb-2 pr-3 text-left">Ticker</th>
                <th className="pb-2 pr-3 text-left">Name</th>
                <th className="pb-2 pr-3 text-right">Qty</th>
                <th className="pb-2 pr-3 text-right">Value</th>
                <th className="pb-2 pr-3 text-right">Wt%</th>
                <th className="pb-2 pr-3 text-right">1d%</th>
                <th className="pb-2 pr-3 text-right">Target / Δ</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h: Holding) => {
                const d = driftById.get(h.id);
                const drift = d?.drift_pct ?? null;
                const hasTarget = d?.has_target ?? false;
                const isEditing = editingId === h.id;
                const isConfirmingDelete = deletingId === h.id;

                if (isEditing) {
                  // Collapsed edit form spanning all 8 columns
                  return (
                    <tr key={h.id} className="border-b border-white/10 bg-white/5">
                      <td colSpan={8} className="py-3 px-2">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                          <div>
                            <p className="mb-1 text-[10px] text-gray-500">Ticker</p>
                            <span className="font-mono text-xs text-white/80">
                              {editForm.asset_class === "cash" ? "CASH ($1.00)" : h.ticker}
                            </span>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] text-gray-500">Name</p>
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="Optional"
                              className="w-full rounded border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white outline-none placeholder:text-gray-500"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] text-gray-500">Class</p>
                            <select
                              value={editForm.asset_class}
                              onChange={(e) => setEditForm((f) => ({ ...f, asset_class: e.target.value as AssetClass }))}
                              className="w-full rounded border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white outline-none"
                            >
                              {ASSET_CLASSES.map((ac) => (
                                <option key={ac} value={ac} className="bg-[#0d1f35]">
                                  {ac.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] text-gray-500">Qty *</p>
                            <input
                              type="number"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                              className="w-full rounded border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white outline-none"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] text-gray-500">Expense % (annual)</p>
                            <input
                              type="number"
                              step="any"
                              value={editForm.expense_ratio}
                              placeholder="0.06"
                              title="Annual expense as percent (e.g. 0.06 = 0.06%)"
                              onChange={(e) => setEditForm((f) => ({ ...f, expense_ratio: e.target.value }))}
                              className="w-full rounded border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white outline-none"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] text-gray-500">Target Wt%</p>
                            <input
                              type="number"
                              step="any"
                              value={editForm.target_weight_pct}
                              placeholder="20"
                              onChange={(e) => setEditForm((f) => ({ ...f, target_weight_pct: e.target.value }))}
                              className="w-full rounded border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white outline-none"
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(h)}
                            disabled={isUpdating}
                            className="rounded border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 transition-colors hover:text-emerald-300 disabled:opacity-50"
                          >
                            {isUpdating ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-xs text-gray-500 transition-colors hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Pre-compute price/value/weight — avoids repeated IIFE and fixes cash guard
                const rowQ = quotesMap.get(h.ticker);
                const rowPrice = h.asset_class === "cash" ? 1.00 : (rowQ?.price ?? Number(h.current_price ?? 0));
                const rowVal = Number(h.quantity) * rowPrice;
                const rowWt = totalPortfolioValue > 0 ? (rowVal / totalPortfolioValue) * 100 : 0;

                return (
                  <tr key={h.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-3 font-mono text-xs text-white">
                      {h.ticker}
                      <span className="ml-1 text-[9px] capitalize text-gray-600">{h.asset_class.replace("_", " ")}</span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-400 max-w-[8rem] truncate" title={h.name ?? undefined}>
                      {h.name?.trim() || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs text-white">
                      {Number(h.quantity).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs text-white">
                      {rowVal === 0 ? "\u2014" : `$${rowVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs text-gray-300">
                      {totalPortfolioValue === 0 ? "\u2014" : `${rowWt.toFixed(2)}%`}
                    </td>
                    <td className={`py-2 pr-3 text-right text-xs font-medium ${changePctClass(h.last_change_pct)}`}>
                      {h.last_change_pct != null && Number.isFinite(Number(h.last_change_pct))
                        ? `${Number(h.last_change_pct) > 0 ? "+" : ""}${Number(h.last_change_pct).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-right text-xs font-medium ${driftClass(drift, hasTarget)}`}>
                      {hasTarget && h.target_weight_pct != null
                        ? `${Number(h.target_weight_pct).toFixed(1)}% (${drift != null ? (drift > 0 ? "+" : "") + drift.toFixed(1) : "—"}%)`
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {isConfirmingDelete ? (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <span className="text-xs text-red-400">Remove?</span>
                          <button
                            type="button"
                            onClick={() =>
                              void (async () => {
                                await deleteHolding({ holdingId: h.id, portfolioId: h.portfolio_id });
                                setDeletingId(null);
                              })()
                            }
                            disabled={isDeleting}
                            className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
                          >
                            {isDeleting ? "…" : "Yes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 text-xs text-gray-500 transition-colors hover:text-white"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(h)}
                            className="px-2 py-1 text-xs text-gray-500 transition-colors hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setDeletingId(h.id);
                            }}
                            className="px-2 py-1 text-xs text-gray-600 transition-colors hover:text-red-400"
                            title="Remove holding"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Ticker *</label>
              <input
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                disabled={form.asset_class === "cash"}
                placeholder={form.asset_class === "cash" ? "CASH (auto)" : "e.g. VTI"}
                className={`w-full rounded border bg-white/10 px-2 py-1.5 text-sm uppercase text-white placeholder-gray-500 outline-none ${
                  form.asset_class === "cash"
                    ? "border-white/10 opacity-60 cursor-not-allowed"
                    : "border-white/20"
                }`}
              />
              {form.asset_class === "cash" && (
                <p className="text-xs text-emerald-400 mt-1">
                  Cash is priced at $1.00 USD &times; quantity
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Optional"
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Asset class *</label>
              <select
                value={form.asset_class}
                onChange={(e) => {
                  const ac = e.target.value as AssetClass;
                  setForm((f) => ({
                    ...f,
                    asset_class: ac,
                    ticker: ac === "cash" ? "CASH" : f.ticker === "CASH" ? "" : f.ticker,
                  }));
                }}
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white outline-none"
              >
                {ASSET_CLASSES.map((ac) => (
                  <option key={ac} value={ac} className="bg-[#0d1f35]">
                    {ac.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Quantity *</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Cost basis</label>
              <input
                type="number"
                value={form.cost_basis}
                onChange={(e) => setForm((f) => ({ ...f, cost_basis: e.target.value }))}
                placeholder="Optional"
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Expense % (annual)</label>
              <input
                type="number"
                step="any"
                value={form.expense_pct}
                onChange={(e) => setForm((f) => ({ ...f, expense_pct: e.target.value }))}
                placeholder="e.g. 0.03 = 0.03%"
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Target %</label>
              <input
                type="number"
                step="any"
                value={form.target_pct}
                onChange={(e) => setForm((f) => ({ ...f, target_pct: e.target.value }))}
                placeholder="e.g. 20"
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm({
                  ticker: "",
                  name: "",
                  asset_class: "equity",
                  quantity: "",
                  cost_basis: "",
                  expense_pct: "",
                  target_pct: "",
                });
              }}
              className="px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isPending || (!form.ticker && form.asset_class !== "cash") || !form.quantity}
              className="rounded bg-emerald-500 px-4 py-1.5 text-xs text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Add holding"}
            </button>
          </div>
        </div>
      )}

      {holdings.length === 0 && !adding && (
        <EmptyState title="No holdings yet" description="Add your first position above" />
      )}
    </div>
  );
}
