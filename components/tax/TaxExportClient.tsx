"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";
import type { TaxLot, TaxSummary } from "@/app/api/tax/form-8949/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}$${abs.toFixed(2)}`;
}

function gainColor(n: number): string {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-gray-400";
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchTaxData(
  year: number,
): Promise<{ taxLots: TaxLot[]; summary: TaxSummary }> {
  const res = await fetch(`/api/tax/form-8949?year=${year}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to fetch tax data");
  }
  return res.json() as Promise<{ taxLots: TaxLot[]; summary: TaxSummary }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaxExportClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1); // default to prior tax year
  const [downloading, setDownloading] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["tax", "form-8949", year],
    queryFn: () => fetchTaxData(year),
    staleTime: STALE.ENGINE,
  });

  async function handleDownloadCSV() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/tax/export-csv?year=${year}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pemabu-form-8949-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV download failed:", e);
    } finally {
      setDownloading(false);
    }
  }

  const summary = data?.summary;
  const taxLots = data?.taxLots ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium text-white">Tax Export</h1>
          <p className="mt-1 text-xs text-gray-500">
            Form 8949 — Capital Gains and Losses. Export for TurboTax, H&amp;R Block, or your
            tax professional.
          </p>
        </div>

        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="rounded-lg border border-white/10 bg-[#0A1628] px-4 py-2 text-sm text-white outline-none"
        >
          {[currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
            <option key={y} value={y}>
              Tax Year {y}
            </option>
          ))}
        </select>
      </div>

      {/* Autonomous tier notice */}
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-5 py-4">
        <p className="text-xs text-amber-400">
          ⚠️ Tax export requires Pemabu Autonomous tier. Trade execution records are generated
          from your local vault ledger only. Proceeds marked $0.00 must be verified from your
          broker statement before filing.
        </p>
      </div>

      {isPending && (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading tax data for {year}...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6">
          <p className="text-sm text-red-400">
            {error instanceof Error ? error.message : "Failed to load tax data."}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Tax export is only available for Autonomous tier users with executed trades in the
            selected tax year.
          </p>
        </div>
      )}

      {summary && (
        <>
          {/* Verification banner */}
          {summary.requiresVerification && (
            <div className="rounded-lg border border-orange-400/20 bg-orange-400/5 px-5 py-4">
              <p className="text-xs text-orange-400">
                ⚠️ Some tax lots show $0.00 proceeds. These rows represent cost-basis-only
                records where the execution price was not captured in the Pemabu vault. Verify
                actual sale proceeds from your broker statement before filing.
              </p>
            </div>
          )}

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                label: "Total Lots",
                value: summary.totalLots.toString(),
                color: "text-white",
              },
              {
                label: "Total Proceeds",
                value: `$${summary.totalProceeds.toFixed(2)}`,
                color: "text-white",
              },
              {
                label: "Total Cost Basis",
                value: `$${summary.totalCostBasis.toFixed(2)}`,
                color: "text-white",
              },
              {
                label: "Net Gain / Loss",
                value: fmtUsd(summary.totalGainLoss),
                color: gainColor(summary.totalGainLoss),
              },
              {
                label: "Short / Long Term",
                value: `${summary.shortTermLots} / ${summary.longTermLots}`,
                color: "text-white",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p
                  className={`mt-1 font-mono text-lg font-medium tabular-nums ${kpi.color}`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Gain/loss breakdown */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: "Short-Term (held < 1 year)",
                value: summary.shortTermGainLoss,
                note: "Taxed as ordinary income",
              },
              {
                label: "Long-Term (held ≥ 1 year)",
                value: summary.longTermGainLoss,
                note: "Taxed at preferential capital gains rates",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs text-gray-500">{item.label}</p>
                <p
                  className={`mt-1.5 text-2xl font-medium tabular-nums ${gainColor(item.value)}`}
                >
                  {fmtUsd(item.value)}
                </p>
                <p className="mt-1 text-[11px] text-gray-600">{item.note}</p>
              </div>
            ))}
          </div>

          {/* Download */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={downloading || taxLots.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Generating...
                </>
              ) : (
                <>↓ Download Form 8949 CSV</>
              )}
            </button>
            <div className="flex flex-col justify-center">
              <p className="text-xs text-gray-500">
                Compatible with TurboTax, H&amp;R Block, FreeTaxUSA
              </p>
            </div>
          </div>

          {/* Tax lots table */}
          {taxLots.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">
                No executed sell trades found for tax year {year}.
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Tax data is generated from trades executed via Pemabu Autonomous.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-gray-500">
                Tax Lots — {year}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="border-b border-white/10">
                    <tr className="text-xs text-gray-500">
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">Acquired</th>
                      <th className="px-4 py-3 text-left">Sold</th>
                      <th className="px-4 py-3 text-right">Proceeds</th>
                      <th className="px-4 py-3 text-right">Cost Basis</th>
                      <th className="px-4 py-3 text-right">Gain / Loss</th>
                      <th className="px-4 py-3 text-center">Term</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxLots.map((lot, i) => (
                      <tr
                        key={i}
                        className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs text-white">{lot.description}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{lot.date_acquired}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{lot.date_sold}</td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-xs ${
                            lot.proceeds_verified ? "text-white" : "text-orange-400"
                          }`}
                        >
                          ${lot.proceeds.toFixed(2)}
                          {!lot.proceeds_verified && (
                            <span
                              className="ml-1 text-[9px] text-orange-400"
                              title="Verify from broker statement"
                            >
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-white">
                          ${lot.cost_basis.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-xs ${gainColor(lot.gain_loss)}`}
                        >
                          {fmtUsd(lot.gain_loss)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              lot.holding_period === "LONG"
                                ? "bg-blue-400/10 text-blue-400"
                                : "bg-amber-400/10 text-amber-400"
                            }`}
                          >
                            {lot.holding_period}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Compliance footer */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-5 py-4">
        <p className="text-xs leading-relaxed text-gray-500">
          <span className="font-medium text-gray-300">Tax disclaimer</span> — This export is
          generated from your local Pemabu vault ledger for informational purposes only. It does
          not constitute tax advice. Proceeds marked ⚠ must be verified against your broker
          statements before filing. Verify all figures with a qualified tax professional. Pemabu
          is not a registered investment advisor or tax preparer.
        </p>
      </div>
    </div>
  );
}
