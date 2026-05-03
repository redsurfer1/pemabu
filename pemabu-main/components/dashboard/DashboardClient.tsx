"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsolidatedDashboard } from "@/hooks/usePortfolios";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { SignalFeed } from "@/components/dashboard/SignalFeed";
import { HoldingsBuilder } from "@/components/workbook/HoldingsBuilder";
import { PortfolioSelector } from "@/components/workbook/PortfolioSelector";

interface DashboardClientProps {
  userId: string;
  userEmail: string;
}

export function DashboardClient({ userId, userEmail }: DashboardClientProps) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const { data, isPending, isError, error } = useConsolidatedDashboard(userId);

  useEffect(() => {
    const list = data?.portfolios;
    if (!list?.length) return;

    setSelectedPortfolioId((prev) => {
      if (prev && list.some((s) => s.portfolio.id === prev)) return prev;
      return list[0]!.portfolio.id;
    });
  }, [data?.portfolios]);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (isPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A1628",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              margin: "0 auto 12px",
              border: "2px solid #10b981",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ margin: 0, fontSize: 14, color: "#9ca3af" }}>Loading dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A1628",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          color: "white",
          fontFamily: "sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#f87171", fontSize: "14px" }}>Dashboard error:</p>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "12px",
            maxWidth: "600px",
            wordBreak: "break-all",
          }}
        >
          {error instanceof Error ? error.message : JSON.stringify(error)}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: "8px",
            padding: "8px 16px",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const portfolios = data?.portfolios ?? [];
  const totalEquity = data?.totalEquity ?? 0;
  const selectedSummary = portfolios.find((p) => p.portfolio.id === selectedPortfolioId);

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-widest text-white">PEMABU</span>
          <PortfolioSelector selectedId={selectedPortfolioId} onSelect={setSelectedPortfolioId} />
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/portfolio/engine${selectedPortfolioId ? `?portfolioId=${encodeURIComponent(selectedPortfolioId)}` : ""}`}
            className="rounded border border-white/10 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"
          >
            Engine
          </Link>
          <span className="text-xs text-gray-500">
            Total Value:{" "}
            <span className="font-medium text-white">
              $
              {totalEquity.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </span>
          {userEmail ? <span className="hidden text-xs text-gray-500 sm:inline">{userEmail}</span> : null}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded border border-white/10 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {portfolios.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr_280px]">
            <div className="space-y-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Your portfolios</h2>
              {portfolios.map((summary) => (
                <PortfolioCard
                  key={summary.portfolio.id}
                  summary={summary}
                  isSelected={summary.portfolio.id === selectedPortfolioId}
                  onClick={() => setSelectedPortfolioId(summary.portfolio.id)}
                />
              ))}
            </div>

            <div>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-500">
                {selectedSummary?.portfolio.name ?? "Holdings"}
              </h2>
              {selectedPortfolioId ? (
                <HoldingsBuilder
                  portfolioId={selectedPortfolioId}
                  currency={
                    (selectedSummary?.portfolio.currency as
                      | "USD"
                      | "GBP"
                      | "EUR"
                      | "CAD"
                      | "AUD") ?? "USD"
                  }
                />
              ) : null}
            </div>

            <div>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-500">Signals</h2>
              {selectedPortfolioId ? <SignalFeed portfolioId={selectedPortfolioId} /> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <p className="mb-2 text-gray-400">No portfolios yet</p>
      <p className="text-sm text-gray-600">
        Use the portfolio selector in the nav to create your first portfolio.
      </p>
    </div>
  );
}
