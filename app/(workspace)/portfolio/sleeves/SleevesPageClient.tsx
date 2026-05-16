"use client";

import Link from "next/link";
import { usePortfolios } from "@/hooks/usePortfolios";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";

export function SleevesPageClient({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<SleevesPageSkeleton />}>
      <SleevesPageContent userId={userId} />
    </Suspense>
  );
}

function SleevesPageContent({ userId: _userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: portfolios = [], isLoading } = usePortfolios();

  const portfolioParam = searchParams.get("portfolio");
  const selected = portfolioParam && portfolios.some((p) => p.id === portfolioParam)
    ? portfolioParam
    : portfolios[0]?.id ?? "";

  const selectedPortfolio = portfolios.find((p) => p.id === selected);

  useEffect(() => {
    if (!selected || isLoading) return;
    if (portfolioParam === selected) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("portfolio", selected);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, portfolioParam, router, searchParams, selected, isLoading]);

  if (isLoading) return <SleevesPageSkeleton />;

  if (portfolios.length === 0) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] px-6 py-12">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="font-[Georgia,serif] text-xl text-white">No portfolios found</h2>
          <p className="mt-2 text-sm text-gray-400">
            Create a portfolio first to use Allocation Intelligence.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded bg-[#C9A84C] px-4 py-2 text-xs font-medium text-[#0D1B2A] transition-colors hover:bg-[#C9A84C]/80"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        {/* Nav bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
            >
              Dashboard
            </Link>
            <Link
              href="/portfolio/engine"
              className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
            >
              Engine v2
            </Link>
          </div>
          <select
            value={selected}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("portfolio", e.target.value);
              router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            className="min-w-[200px] rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-[#C9A84C]/50"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0D1B2A]">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dashboard */}
        <PortfolioDashboard
          portfolioId={selected}
          portfolioName={selectedPortfolio?.name ?? "Portfolio"}
        />
      </div>
    </div>
  );
}

function SleevesPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] px-6 py-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-white/5" />
          <div className="h-8 w-52 animate-pulse rounded bg-white/5" />
        </div>
        <div className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/5" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
