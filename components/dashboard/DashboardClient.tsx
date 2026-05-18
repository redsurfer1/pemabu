"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useConsolidatedDashboard } from "@/hooks/usePortfolios";
import { useDashboardServices } from "@/components/dashboard/DashboardServicesContext";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { ServicesSidebar } from "@/components/dashboard/ServicesSidebar";
import { SignalFeed } from "@/components/dashboard/SignalFeed";
import { HoldingsBuilder } from "@/components/workbook/HoldingsBuilder";
import { SystemSafetyBanner } from "@/components/execution/SystemSafetyBanner";
import { WORKSPACE_PORTFOLIO_STORAGE_KEY } from "@/components/navigation/WorkspaceChrome";

interface DashboardClientProps {
  userId: string;
  userEmail: string;
}

export function DashboardClient({ userId }: DashboardClientProps) {
  const { servicesOpen } = useDashboardServices();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const { data, isPending, isError, error } = useConsolidatedDashboard(userId);

  useEffect(() => {
    const list = data?.portfolios;
    if (!list?.length) return;

    setSelectedPortfolioId((prev) => {
      if (prev && list.some((s) => s.portfolio.id === prev)) return prev;
      try {
        const stored = localStorage.getItem(WORKSPACE_PORTFOLIO_STORAGE_KEY);
        if (stored && list.some((s) => s.portfolio.id === stored)) return stored;
      } catch {
        /* ignore */
      }
      return list[0]!.portfolio.id;
    });
  }, [data?.portfolios]);

  useEffect(() => {
    if (!selectedPortfolioId) return;
    try {
      localStorage.setItem(WORKSPACE_PORTFOLIO_STORAGE_KEY, selectedPortfolioId);
    } catch {
      /* ignore */
    }
  }, [selectedPortfolioId]);

  useEffect(() => {
    const onPortfolioChange = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setSelectedPortfolioId(id);
    };
    window.addEventListener("pemabu-portfolio-change", onPortfolioChange);
    return () => window.removeEventListener("pemabu-portfolio-change", onPortfolioChange);
  }, []);

  const selectPortfolio = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    window.dispatchEvent(new CustomEvent("pemabu-portfolio-change", { detail: portfolioId }));
  };

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" aria-hidden />
          <p className="text-sm text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <p className="text-sm text-red-400">Dashboard error:</p>
        <p className="max-w-xl break-all text-xs text-gray-400">
          {error instanceof Error ? error.message : JSON.stringify(error)}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-md bg-emerald-500 px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const portfolios = data?.portfolios ?? [];
  const selectedSummary = portfolios.find((p) => p.portfolio.id === selectedPortfolioId);

  return (
    <>
      <SystemSafetyBanner portfolioId={selectedPortfolioId} />

      <div className="w-full px-4 py-8 lg:px-6 xl:px-8">
        {portfolios.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className={`grid grid-cols-1 gap-6 lg:gap-5 ${
              servicesOpen
                ? "lg:grid-cols-[200px_220px_minmax(0,1fr)_minmax(0,200px)]"
                : "lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,200px)]"
            }`}
          >
            {servicesOpen ? (
              <div id="dashboard-services-sidebar" className="hidden lg:block">
                <ServicesSidebar />
              </div>
            ) : null}

            <div className="space-y-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Your portfolios</h2>
              {portfolios.map((summary) => (
                <PortfolioCard
                  key={summary.portfolio.id}
                  summary={summary}
                  isSelected={summary.portfolio.id === selectedPortfolioId}
                  onClick={() => selectPortfolio(summary.portfolio.id)}
                />
              ))}
            </div>

            <div className="min-w-0">
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

            <div className="w-full max-w-[200px] justify-self-end lg:sticky lg:top-6 lg:self-start">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Signals</h2>
              {selectedPortfolioId ? <SignalFeed portfolioId={selectedPortfolioId} compact /> : null}
            </div>
          </div>
        )}

        {servicesOpen ? (
          <div className="mt-6 lg:hidden">
            <ServicesSidebar />
          </div>
        ) : null}
      </div>
    </>
  );
}

function EmptyState() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createDemo = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workbook/demo-portfolio", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to create demo portfolio");
      await queryClient.invalidateQueries({ queryKey: ["consolidated"] });
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="mb-2 text-gray-300">Welcome to Pemabu</p>
      <p className="mb-8 text-sm text-gray-500">
        Start with a pre-built sample portfolio or create your own from the nav.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void createDemo()}
        className="rounded-md bg-emerald-500 px-6 py-2.5 text-sm font-medium text-[#0A1628] disabled:opacity-60"
      >
        {loading ? "Creating demo…" : "Create demo portfolio"}
      </button>
      <p className="mt-4">
        <Link href="/demo" className="text-sm text-emerald-400/90 hover:text-emerald-300">
          Preview features on the public demo →
        </Link>
      </p>
      {message ? <p className="mt-3 text-xs text-red-400/90">{message}</p> : null}
    </div>
  );
}
