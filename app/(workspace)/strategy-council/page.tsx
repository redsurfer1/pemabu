"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortfolios } from "@/hooks/usePortfolios";
import { generateStrategyCouncilMemoAction } from "@/lib/actions/intelligence/generateStrategyCouncilMemo";
import { exportSleeveStrategyAction } from "@/lib/actions/portfolio/exportSleeveStrategyAction";
import { STRATEGY_COUNCIL_PRINT_STORAGE_KEY } from "@/lib/intelligence/strategy-council-print-key";
import type { StrategyCouncilMemoPayload } from "@/lib/services/ai";

type SleeveRow = { id: string; name: string; purpose: string };

export default function StrategyCouncilPage() {
  const { data: portfolios = [] } = usePortfolios();
  const [portfolioId, setPortfolioId] = useState("");
  const [sleeves, setSleeves] = useState<SleeveRow[]>([]);
  const [sleeveId, setSleeveId] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [lastMemoPayload, setLastMemoPayload] = useState<StrategyCouncilMemoPayload | null>(null);

  useEffect(() => {
    if (!portfolioId) {
      setSleeves([]);
      setSleeveId("");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/sleeves`, { credentials: "include" });
      if (!res.ok) {
        setSleeves([]);
        return;
      }
      const j = (await res.json()) as { sleeves: SleeveRow[] };
      setSleeves(j.sleeves ?? []);
      setSleeveId((prev) => {
        if (prev && j.sleeves?.some((s) => s.id === prev)) return prev;
        return j.sleeves?.[0]?.id ?? "";
      });
    })();
  }, [portfolioId]);

  useEffect(() => {
    if (!portfolios.length) return;
    setPortfolioId((p) => (p && portfolios.some((x) => x.id === p) ? p : portfolios[0]!.id));
  }, [portfolios]);

  async function onGenerateMemo() {
    if (!portfolioId) return;
    setMemoBusy(true);
    setMsg(null);
    try {
      const r = await generateStrategyCouncilMemoAction(portfolioId);
      if (!r.success) {
        setMsg(r.error);
        return;
      }
      const payload: StrategyCouncilMemoPayload = { markdown: r.markdown, pdfLayout: r.pdfLayout };
      sessionStorage.setItem(STRATEGY_COUNCIL_PRINT_STORAGE_KEY, JSON.stringify(payload));
      setLastMemoPayload(payload);
      window.open("/strategy-council/print", "_blank", "noopener,noreferrer");
    } finally {
      setMemoBusy(false);
    }
  }

  async function onExportSleeve() {
    if (!sleeveId) return;
    setExportBusy(true);
    setMsg(null);
    try {
      const r = await exportSleeveStrategyAction(sleeveId);
      if (!r.success) {
        setMsg(r.error);
        setToken("");
        return;
      }
      setToken(r.sleeveToken);
    } finally {
      setExportBusy(false);
    }
  }

  async function onDownloadPdf() {
    if (!lastMemoPayload) return;
    setPdfBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/strategy-council/memo-pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastMemoPayload),
      });
      if (res.status === 403) {
        const j = (await res.json().catch(() => ({}))) as { requiredTier?: string };
        setMsg(
          j.requiredTier
            ? `Autonomous tier required (REQUIRED_TIER: ${j.requiredTier}).`
            : "Autonomous tier required for PDF download.",
        );
        return;
      }
      if (!res.ok) {
        setMsg("PDF download failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `strategy-council-memo-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="text-gray-200">
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
        <div>
          <h1 className="font-serif text-2xl text-white">Strategy Council</h1>
          <p className="mt-2 text-sm text-gray-400">
            Institutional memory and portable sleeve blueprints. LLM memo runs only when you click generate — nothing
            is sent automatically.
          </p>
        </div>

        <section className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Monthly memo</h2>
          <label className="mt-3 block text-xs text-gray-500">Portfolio</label>
          <select
            className="mt-1 w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
            disabled={!portfolios.length}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={memoBusy || !portfolioId}
            onClick={() => void onGenerateMemo()}
            className="mt-4 w-full rounded border border-amber-500/40 bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-40"
          >
            {memoBusy ? "Generating…" : "Generate memo & open print view"}
          </button>
          <button
            type="button"
            disabled={pdfBusy || !lastMemoPayload}
            onClick={() => void onDownloadPdf()}
            className="mt-3 w-full rounded border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
          >
            {pdfBusy ? "Preparing PDF…" : "Download PDF (Autonomous)"}
          </button>
          <p className="mt-2 text-[11px] text-gray-500">
            PDF binary uses react-pdf on the server. Requires Autonomous tier; includes a non-fiduciary disclaimer
            footer.
          </p>
        </section>

        <section className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Portable sleeve (blueprint)</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            Pemabu is a local-first software utility. All strategies are for informational purposes; the user retains
            full fiduciary responsibility for execution. Not a registered investment advisor.
          </p>
          <label className="mt-3 block text-xs text-gray-500">Sleeve</label>
          <select
            className="mt-1 w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
            value={sleeveId}
            onChange={(e) => setSleeveId(e.target.value)}
            disabled={!sleeves.length}
          >
            {sleeves.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.purpose}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={exportBusy || !sleeveId}
            onClick={() => void onExportSleeve()}
            className="mt-4 w-full rounded border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
          >
            {exportBusy ? "Exporting…" : "Export sleeve token"}
          </button>
          {token ? (
            <textarea
              readOnly
              className="mt-4 h-28 w-full rounded border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-emerald-100/90"
              value={token}
            />
          ) : null}
        </section>

        {msg ? <p className="text-sm text-red-400">{msg}</p> : null}

        <p className="text-center text-xs text-gray-600">
          <Link href="/marketplace" className="text-emerald-400/80 hover:text-emerald-300">
            Strategy marketplace leaderboard →
          </Link>
        </p>
      </div>
    </div>
  );
}
