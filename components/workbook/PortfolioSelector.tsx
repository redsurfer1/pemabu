"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";
import {
  fetchSignals,
  portfolioKeys,
  useCreatePortfolio,
  usePortfolios,
  toSignalFiltersRecord,
} from "@/hooks/usePortfolios";

const UNACK_FILTERS = toSignalFiltersRecord({ status: "unacknowledged", limit: 100 });

interface PortfolioSelectorProps {
  selectedId: string | null;
  onSelect: (portfolioId: string) => void;
  className?: string;
}

export function PortfolioSelector({ selectedId, onSelect, className = "" }: PortfolioSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: portfolios = [], isLoading } = usePortfolios();

  const unackQueries = useQueries({
    queries: portfolios.map((p) => ({
      queryKey: portfolioKeys.signals(p.id, UNACK_FILTERS),
      queryFn: () => fetchSignals(p.id, { status: "unacknowledged", limit: 100 }),
      staleTime: STALE.PRICES,
      enabled: !isLoading && portfolios.length > 0,
    })),
  });

  const unackCountById = useMemo(() => {
    const m = new Map<string, number>();
    portfolios.forEach((p, i) => {
      const n = unackQueries[i]?.data?.length ?? 0;
      m.set(p.id, n);
    });
    return m;
  }, [portfolios, unackQueries]);

  const totalUnack = useMemo(() => {
    let t = 0;
    unackCountById.forEach((n) => {
      t += n;
    });
    return t;
  }, [unackCountById]);

  const selected = portfolios.find((p) => p.id === selectedId);

  if (isLoading) {
    return <div className={`text-sm text-gray-400 ${className}`}>Loading portfolios...</div>;
  }

  if (portfolios.length === 0) {
    return (
      <div className={`flex flex-col gap-2 text-sm ${className}`}>
        <span className="text-gray-400">No portfolios yet</span>
        <CreatePortfolioButton onCreated={onSelect} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <span className="max-w-[160px] truncate">{selected?.name ?? "Select portfolio"}</span>
        {totalUnack > 0 && (
          <span
            className="min-w-[1.25rem] rounded-full bg-amber-500/20 px-1.5 py-0.5 text-center text-[10px] font-semibold text-amber-400"
            title={`${totalUnack} unacknowledged signal${totalUnack === 1 ? "" : "s"} (your portfolios)`}
          >
            {totalUnack > 99 ? "99+" : totalUnack}
          </span>
        )}
        <span className="ml-1 text-gray-400">{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-white/10 bg-[#0d1f35] shadow-xl">
          {portfolios.map((portfolio) => {
            const n = unackCountById.get(portfolio.id) ?? 0;
            return (
              <button
                key={portfolio.id}
                type="button"
                onClick={() => {
                  onSelect(portfolio.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-white/5 ${
                  portfolio.id === selectedId ? "text-emerald-400" : "text-white"
                }`}
              >
                <span className="truncate">{portfolio.name}</span>
                <span className="ml-2 flex shrink-0 items-center gap-2">
                  {n > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{portfolio.currency}</span>
                </span>
              </button>
            );
          })}
          <div className="border-t border-white/10 p-2">
            <CreatePortfolioButton
              onCreated={(id) => {
                onSelect(id);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePortfolioButton({ onCreated }: { onCreated: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const { mutateAsync, isPending } = useCreatePortfolio();

  if (!creating) {
    return (
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full px-2 py-1.5 text-left text-xs text-emerald-400 transition-colors hover:text-emerald-300"
      >
        + New portfolio
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Portfolio name"
        className="flex-1 rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none"
        disabled={isPending}
        onKeyDown={async (e) => {
          if (e.key === "Enter" && name.trim()) {
            const result = await mutateAsync({ name: name.trim() });
            onCreated(result.portfolio.id);
            setName("");
            setCreating(false);
          }
          if (e.key === "Escape") {
            setCreating(false);
            setName("");
          }
        }}
      />
    </div>
  );
}
