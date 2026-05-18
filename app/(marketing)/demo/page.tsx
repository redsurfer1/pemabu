"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MarketingNav from "@/components/home/MarketingNav";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";
import { AllocationRing } from "@/components/allocation/AllocationRing";
import type { AllocationWeight } from "@/lib/types/database";
import AuthModal from "@/components/AuthModal";

type DemoPayload = {
  name: string;
  total_value: number;
  holdings_count: number;
  currency: string;
  allocation: AllocationWeight[];
  features: Array<{ title: string; desc: string }>;
};

export default function DemoPage() {
  const [data, setData] = useState<DemoPayload | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/demo-portfolio")
      .then((r) => r.json())
      .then((j) => setData(j as DemoPayload))
      .catch(() => setError("Could not load demo data"));
  }, []);

  return (
    <div className="min-h-screen bg-[#0A1628] text-slate-200">
      {showAuth ? <AuthModal onClose={() => setShowAuth(false)} /> : null}
      <MarketingNav onSignIn={() => setShowAuth(true)} />

      <main className="mx-auto max-w-4xl px-6 pb-20 pt-28">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400">Live product demo</p>
        <h1 className="text-3xl font-light tracking-wide text-white">{data?.name ?? "Allocation demo"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Explore Pemabu&apos;s interactive allocation ring — each segment is an asset class. Dots on the dashed inner
          ring mark your targets. Tap a segment to see actual vs target weight and drift.
        </p>

        {error ? (
          <p className="mt-8 text-sm text-red-400">{error}</p>
        ) : !data ? (
          <p className="mt-12 text-sm text-slate-500">Loading demo…</p>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-xs uppercase tracking-wider text-slate-500">Portfolio value</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {data.currency}{" "}
                {data.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-slate-500">{data.holdings_count} sample holdings</p>
              <div className="mt-6 flex justify-center">
                <AllocationRing allocation={data.allocation} size={200} interactive />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">What you get</h2>
              <ul className="mt-4 space-y-4">
                {data.features.map((f) => (
                  <li key={f.title} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-sm font-medium text-emerald-400/90">{f.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-[#0A1628]"
                >
                  Sign up & create your demo portfolio
                </button>
                <Link
                  href="/request-access"
                  className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                >
                  Request access
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#1a2f4e] px-6 py-8">
        <SiteLegalFooter />
      </footer>
    </div>
  );
}
