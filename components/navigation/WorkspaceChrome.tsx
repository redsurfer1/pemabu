"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PemabuLogoCompact } from "@/components/brand/PemabuLogo";
import { PortfolioSelector } from "@/components/workbook/PortfolioSelector";
import { WorkspaceNav } from "@/components/navigation/WorkspaceNav";
import { useConsolidatedDashboard } from "@/hooks/usePortfolios";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { WORKSPACE_PORTFOLIO_STORAGE_KEY } from "@/lib/workspace/portfolio-selection";
import { InvestmentDisclaimerBanner } from "@/components/legal/InvestmentDisclaimerBanner";

export const SERVICES_SIDEBAR_STORAGE_KEY = "pemabu.dashboard.servicesOpen";
export { WORKSPACE_PORTFOLIO_STORAGE_KEY };

export type WorkspaceChromeProps = {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
  /** Dashboard only: toggles services sidebar instead of linking away */
  servicesToggle?: boolean;
  servicesOpen?: boolean;
  onServicesToggle?: () => void;
};

function readPortfolioFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("portfolio") ?? params.get("portfolio_id");
}

export function WorkspaceChrome({
  userId,
  userEmail,
  children,
  servicesToggle = false,
  servicesOpen = false,
  onServicesToggle,
}: WorkspaceChromeProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const { data } = useConsolidatedDashboard(userId);
  const totalEquity = data?.totalEquity ?? 0;
  const portfolios = data?.portfolios ?? [];

  useEffect(() => {
    const list = data?.portfolios;
    if (!list?.length) return;

    setSelectedPortfolioId((prev) => {
      if (prev && list.some((s) => s.portfolio.id === prev)) return prev;

      const fromUrl = readPortfolioFromUrl();
      if (fromUrl && list.some((s) => s.portfolio.id === fromUrl)) return fromUrl;

      try {
        const stored = localStorage.getItem(WORKSPACE_PORTFOLIO_STORAGE_KEY);
        if (stored && list.some((s) => s.portfolio.id === stored)) return stored;
      } catch {
        /* private mode */
      }
      return list[0]!.portfolio.id;
    });
  }, [data?.portfolios]);

  useEffect(() => {
    const onPortfolioChange = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setSelectedPortfolioId(id);
    };
    window.addEventListener("pemabu-portfolio-change", onPortfolioChange);
    return () => window.removeEventListener("pemabu-portfolio-change", onPortfolioChange);
  }, []);

  const handlePortfolioSelect = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    window.dispatchEvent(new CustomEvent("pemabu-portfolio-change", { detail: portfolioId }));
    try {
      localStorage.setItem(WORKSPACE_PORTFOLIO_STORAGE_KEY, portfolioId);
    } catch {
      /* ignore */
    }

    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.has("portfolio")) {
      params.set("portfolio", portfolioId);
      changed = true;
    }
    if (params.has("portfolio_id")) {
      params.set("portfolio_id", portfolioId);
      changed = true;
    }
    if (changed) {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const openServicesOnDashboard = () => {
    try {
      localStorage.setItem(SERVICES_SIDEBAR_STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <nav className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0A1628] px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 no-underline transition-opacity hover:opacity-90"
            aria-label="PEMABU dashboard home"
          >
            <PemabuLogoCompact size={30} />
            <span className="text-[15px] font-semibold tracking-wide text-slate-100">PEMABU</span>
          </Link>
          {servicesToggle && onServicesToggle ? (
            <button
              type="button"
              onClick={onServicesToggle}
              className={`rounded border px-3 py-1 text-xs transition-colors ${
                servicesOpen
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
              }`}
              aria-expanded={servicesOpen}
              aria-controls="dashboard-services-sidebar"
            >
              {servicesOpen ? "Hide services" : "Show services"}
            </button>
          ) : (
            <Link
              href="/dashboard"
              onClick={openServicesOnDashboard}
              className="rounded border border-white/10 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"
            >
              Show services
            </Link>
          )}
          <PortfolioSelector selectedId={selectedPortfolioId} onSelect={handlePortfolioSelect} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <WorkspaceNav portfolioId={selectedPortfolioId} />
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
      <InvestmentDisclaimerBanner />
      {children}
    </div>
  );
}
