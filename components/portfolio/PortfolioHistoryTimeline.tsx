"use client";

import { useEffect, useState } from "react";
import {
  formatEventDate,
  groupEventsByMonth,
} from "@/lib/portfolio/portfolio-memory-events";
import { PortfolioHistorySkeleton } from "@/components/portfolio/PortfolioHistorySkeleton";
import type { MemoryEvent, PortfolioMemoryResponse } from "@/lib/types/portfolio-memory";

const EVENT_ICONS: Record<MemoryEvent["type"], string> = {
  portfolio_created: "🏛️",
  holding_added: "📈",
  holding_removed: "📉",
  assumption_changed: "⚙️",
  drift_alert: "⚠️",
  brief_generated: "📋",
};

const EVENT_BORDER: Record<MemoryEvent["type"], string> = {
  portfolio_created: "border-emerald-500/50",
  holding_added: "border-sky-500/50",
  holding_removed: "border-orange-500/50",
  assumption_changed: "border-purple-500/50",
  drift_alert: "border-amber-500/50",
  brief_generated: "border-slate-500/50",
};

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span aria-hidden="true">{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function TimelineEvent({ event }: { event: MemoryEvent }) {
  return (
    <div className="relative pl-10">
      <div
        className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-[#0d1524] text-[10px] ${EVENT_BORDER[event.type]}`}
        aria-hidden="true"
      >
        {EVENT_ICONS[event.type]}
      </div>
      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug text-gray-100">{event.title}</p>
          <time className="text-xs text-gray-500 whitespace-nowrap shrink-0" dateTime={event.timestamp}>
            {formatEventDate(event.timestamp)}
          </time>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
      </div>
    </div>
  );
}

export function PortfolioHistoryTimeline({ portfolioId }: { portfolioId: string }) {
  const [data, setData] = useState<PortfolioMemoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/workbook/portfolio-memory?portfolioId=${encodeURIComponent(portfolioId)}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Failed to load portfolio history");
        setData((await res.json()) as PortfolioMemoryResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [portfolioId]);

  if (loading) return <PortfolioHistorySkeleton />;

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3">
        <p className="text-sm text-red-300">Failed to load history: {error}</p>
      </div>
    );
  }

  const events = data?.events ?? [];
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3" aria-hidden="true">
          📊
        </p>
        <p className="text-sm text-gray-500">
          No history yet. Add holdings to start building your allocation story.
        </p>
      </div>
    );
  }

  const grouped = groupEventsByMonth([...events].reverse());

  return (
    <div className="space-y-8">
      {data?.summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Holdings added" value={data.summary.holdingsAdded} icon="📈" />
          <StatCard label="Drift alerts" value={data.summary.driftAlertsReceived} icon="⚠️" />
          <StatCard label="AI briefs" value={data.summary.briefsGenerated} icon="📋" />
          <StatCard label="Days active" value={data.daysSinceCreation} icon="📅" />
        </div>
      ) : null}

      {[...grouped.entries()].map(([month, monthEvents]) => (
        <section key={month}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{month}</h2>
          <div className="space-y-2 relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" aria-hidden="true" />
            {monthEvents.map((event) => (
              <TimelineEvent key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}

      {data?.limitations?.length ? (
        <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4">
          {data.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
