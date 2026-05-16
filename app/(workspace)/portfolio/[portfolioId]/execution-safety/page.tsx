"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Entry = { succeeded: boolean; error_code: string | null; created_at: string };

export default function ExecutionSafetyPage() {
  const params = useParams();
  const portfolioId = params.portfolioId as string;
  const [rows, setRows] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolioId) return;
    void (async () => {
      setErr(null);
      const res = await fetch(`/api/portfolio/execution-errors?portfolioId=${encodeURIComponent(portfolioId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setErr("Unable to load safety log.");
        return;
      }
      const j = (await res.json()) as { entries: Entry[] };
      setRows(j.entries ?? []);
    })();
  }, [portfolioId]);

  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-10 text-gray-200">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-xs text-emerald-400/90 hover:text-emerald-300">
          ← Back
        </Link>
        <h1 className="mt-4 font-serif text-2xl text-white">Execution safety log</h1>
        <p className="mt-2 text-sm text-gray-400">
          Append-only protocol outcomes for this portfolio (no position-level detail).
        </p>
        {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}
        <div className="mt-8 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/30 text-gray-500">
              <tr>
                <th className="px-3 py-2">Time (UTC)</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.created_at}-${i}`} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-gray-300">{r.created_at}</td>
                  <td className="px-3 py-2">{r.succeeded ? "OK" : "Failure"}</td>
                  <td className="px-3 py-2 font-mono text-amber-200/90">{r.error_code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
