"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";
import { usePortfolios } from "@/hooks/usePortfolios";
import { importSleeveStrategyAction } from "@/lib/actions/portfolio/importSleeveStrategyAction";

import { PemabuDisclaimer } from "@/components/ui/PemabuDisclaimer";
import { StrategyPerformanceCell } from "@/components/marketplace/StrategyPerformanceCell";

type TeaserRow = {
  display_name: string;
  strategy_grade: string;
  vw_rsi_performance_score: string;
};

type FullRow = TeaserRow & {
  id: string;
  blueprint_adherence_score: string;
  published_at: string;
  publisher_pseudonym: string;
};

type Viewer = { isIntelligence: boolean; authenticated: boolean };

function rowKey(r: TeaserRow | FullRow, i: number): string {
  return "id" in r && r.id ? r.id : `${r.display_name}-${i}`;
}

export default function MarketplacePage() {
  const qc = useQueryClient();
  const { data: portfolios = [] } = usePortfolios();
  const leaderboardQuery = useQuery({
    queryKey: ["marketplace", "leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/leaderboard", { credentials: "include" });
      if (!res.ok) throw new Error("Leaderboard unavailable.");
      return (await res.json()) as { strategies: (TeaserRow | FullRow)[]; viewer: Viewer };
    },
    staleTime: STALE.LEADERBOARD,
  });

  const rows = leaderboardQuery.data?.strategies ?? [];
  const viewer = leaderboardQuery.data?.viewer ?? { isIntelligence: false, authenticated: false };
  const err = leaderboardQuery.isError ? "Leaderboard unavailable." : null;
  const [sleeveToken, setSleeveToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sourceSleeveId, setSourceSleeveId] = useState("");
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [importPortfolioId, setImportPortfolioId] = useState("");
  const [importToken, setImportToken] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolios.length) return;
    setImportPortfolioId((p) => (p && portfolios.some((x) => x.id === p) ? p : portfolios[0]!.id));
  }, [portfolios]);

  async function publish() {
    setPubMsg(null);
    const res = await fetch("/api/marketplace/publish", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sleeveToken: sleeveToken.trim(),
        displayName: displayName.trim() || "Anonymous strategy",
        metadata: {},
        ...(sourceSleeveId.trim() ? { sourceSleeveId: sourceSleeveId.trim() } : {}),
      }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      const tier = res.headers.get("REQUIRED_TIER");
      setPubMsg(
        res.status === 403 && tier
          ? `Intelligence tier required (REQUIRED_TIER: ${tier}).`
          : (j.error ?? "Publish failed"),
      );
      return;
    }
    setPubMsg("Published.");
    setSleeveToken("");
    await qc.invalidateQueries({ queryKey: ["marketplace", "leaderboard"] });
  }

  async function doImport() {
    setImportMsg(null);
    setImportBusy(true);
    try {
      const r = await importSleeveStrategyAction(importPortfolioId, importToken.trim());
      if (!r.success) {
        if ("code" in r && r.code === "TIER_REQUIRED" && "requiredTier" in r) {
          setImportMsg(`Intelligence tier required (REQUIRED_TIER: ${r.requiredTier}).`);
        } else if ("code" in r && r.code === "PAYMENT_REQUIRED") {
          setImportMsg(
            `${r.error} Purchase an import token ($4.99) — paste the sleeve token, click “Buy import token”, complete Stripe checkout, then import again.`,
          );
        } else {
          setImportMsg(r.error);
        }
        return;
      }
      setImportMsg(`Imported new sleeve (target protocol only). Sleeve id: ${r.sleeveId}`);
      setImportToken("");
    } finally {
      setImportBusy(false);
    }
  }

  async function startUnlockCheckout() {
    setImportMsg(null);
    setImportBusy(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeveToken: importToken.trim() }),
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setImportMsg(j.error ?? "Could not start checkout");
        return;
      }
      if (j.url) {
        window.location.assign(j.url);
        return;
      }
      setImportMsg("Checkout did not return a redirect URL");
    } finally {
      setImportBusy(false);
    }
  }

  const showPrivate = viewer.isIntelligence;

  return (
    <div className="text-gray-200">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-serif text-2xl text-white">Strategy marketplace</h1>
        <p className="mt-2 text-sm text-gray-400">
          Public leaderboard teaser — strategy names and aggregate scores only. No tickers, balances, or accounts
          revealed.
        </p>

        <h2 className="mt-10 text-xs font-semibold uppercase tracking-widest text-gray-500">Leaderboard</h2>
        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/30 text-gray-500">
              <tr>
                {showPrivate ? <th className="px-3 py-2">Peer</th> : null}
                <th className="px-3 py-2">Strategy name</th>
                <th className="px-3 py-2">Strategy grade</th>
                <th className="px-3 py-2">VW-RSI performance</th>
                {showPrivate ? (
                  <>
                    <th className="px-3 py-2">Protocol adherence</th>
                    <th className="px-3 py-2">Track record</th>
                    <th className="px-3 py-2">Published</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={rowKey(r, i)} className="border-t border-white/5">
                  {showPrivate && "publisher_pseudonym" in r ? (
                    <td className="px-3 py-2 font-mono text-gray-400">{(r as FullRow).publisher_pseudonym}</td>
                  ) : null}
                  <td className="px-3 py-2 text-white">{r.display_name}</td>
                  <td className="px-3 py-2 font-mono text-emerald-200/90">{r.strategy_grade}</td>
                  <td className="px-3 py-2 font-mono text-gray-300">{r.vw_rsi_performance_score}</td>
                  {showPrivate && "blueprint_adherence_score" in r && "id" in r ? (
                    <>
                      <td className="px-3 py-2 font-mono text-gray-300">{(r as FullRow).blueprint_adherence_score}</td>
                      <td className="px-3 py-2">
                        <StrategyPerformanceCell
                          strategyId={(r as FullRow).id}
                          strategyName={r.display_name}
                          showPrivate={showPrivate}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-500">{(r as FullRow).published_at.slice(0, 10)}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Import blueprint</h2>
          <PemabuDisclaimer className="mt-2 text-[11px]" />
          {!showPrivate ? (
            <div className="mt-4 rounded border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-gray-300">
              {!viewer.authenticated ? (
                <Link href="/" className="font-medium text-sky-300 underline decoration-sky-500/50 hover:text-white">
                  Login to import strategy
                </Link>
              ) : (
                <Link
                  href="/request-access"
                  className="font-medium text-sky-300 underline decoration-sky-500/50 hover:text-white"
                >
                  Upgrade to Intelligence to import strategies
                </Link>
              )}
              <p className="mt-2 text-xs text-gray-500">Blueprint JSON and protocol import require Intelligence tier.</p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-xs text-gray-500">
                Creates a new sleeve with target protocol slots only — existing holdings are never overwritten.
              </p>
              <label className="mt-3 block text-xs text-gray-500">Portfolio</label>
              <select
                className="mt-1 w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
                value={importPortfolioId}
                onChange={(e) => setImportPortfolioId(e.target.value)}
                disabled={!portfolios.length}
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <textarea
                className="mt-3 h-24 w-full rounded border border-white/10 bg-[#0d1524] p-3 font-mono text-[11px] text-gray-200"
                placeholder="Paste SleeveToken (Base64URL) — not raw blueprint JSON"
                value={importToken}
                onChange={(e) => setImportToken(e.target.value)}
              />
              <button
                type="button"
                disabled={importBusy || !importPortfolioId || !importToken.trim()}
                onClick={() => void doImport()}
                className="mt-3 rounded border border-sky-500/40 bg-sky-950/30 px-4 py-2 text-sm text-sky-100 hover:bg-sky-950/50 disabled:opacity-40"
              >
                {importBusy ? "Importing…" : "Import sleeve protocol"}
              </button>
              <button
                type="button"
                disabled={importBusy || !importToken.trim()}
                onClick={() => void startUnlockCheckout()}
                className="ml-2 mt-3 rounded border border-emerald-500/40 bg-emerald-950/20 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-40"
              >
                Buy import token — $4.99 (Stripe)
              </button>
              {importMsg ? <p className="mt-2 text-xs text-gray-400">{importMsg}</p> : null}
            </>
          )}
        </section>

        <section className="mt-8 rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Publish blueprint</h2>
          <PemabuDisclaimer className="mt-2 text-[11px]" />
          {!showPrivate ? (
            <p className="mt-4 text-sm text-gray-500">
              Publishing (including blueprint payload) is available to Intelligence subscribers after authentication.
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs text-gray-500">
                Optional source sleeve id (yours) refines the public grade using anonymized VW-RSI and drift fidelity —
                never exposes tickers on the leaderboard.
              </p>
              <input
                className="mt-3 w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 font-mono text-[11px] text-gray-200"
                placeholder="Optional: source sleeve UUID (for grade calibration)"
                value={sourceSleeveId}
                onChange={(e) => setSourceSleeveId(e.target.value)}
              />
              <textarea
                className="mt-2 h-24 w-full rounded border border-white/10 bg-[#0d1524] p-3 font-mono text-[11px] text-gray-200"
                placeholder="Paste SleeveToken (Base64URL)"
                value={sleeveToken}
                onChange={(e) => setSleeveToken(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void publish()}
                className="mt-3 rounded border border-emerald-500/40 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950/50"
              >
                Publish to vault leaderboard
              </button>
              {pubMsg ? <p className="mt-2 text-xs text-gray-400">{pubMsg}</p> : null}
            </>
          )}
        </section>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <PemabuDisclaimer className="text-[11px]" />
        </div>
      </div>
    </div>
  );
}
