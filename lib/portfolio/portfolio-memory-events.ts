import { NON_FIDUCIARY_FOOTER } from "@/lib/constants/compliance";
import type { MemoryEvent } from "@/lib/types/portfolio-memory";

export const PORTFOLIO_MEMORY_NOTICE = NON_FIDUCIARY_FOOTER;

export function formatEventDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function groupEventsByMonth(events: MemoryEvent[]): Map<string, MemoryEvent[]> {
  const groups = new Map<string, MemoryEvent[]>();
  for (const event of events) {
    const date = new Date(event.timestamp);
    const key = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return groups;
}

export function sortEventsChronologically(events: MemoryEvent[]): MemoryEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

type PortfolioRow = { id: string; name: string; created_at: string };
type HoldingRow = {
  id: string;
  ticker: string;
  asset_class: string;
  created_at: string;
};
type DriftRow = {
  id: string;
  drift_pct: number | string;
  metric: string;
  detected_at: string;
};
type BriefRow = { id: string; generated_at: string };
type AssumptionRow = { id: string; created_at?: string; updated_at?: string };
type AuditRow = {
  id: string;
  event_type: string;
  ticker: string;
  created_at: string;
};

export function buildPortfolioMemoryEvents(input: {
  portfolio: PortfolioRow;
  holdings?: HoldingRow[];
  driftAlerts?: DriftRow[];
  briefs?: BriefRow[];
  assumptions?: AssumptionRow[];
  auditLog?: AuditRow[];
}): MemoryEvent[] {
  const events: MemoryEvent[] = [];

  events.push({
    id: `portfolio-created-${input.portfolio.id}`,
    type: "portfolio_created",
    timestamp: input.portfolio.created_at,
    title: "Portfolio created",
    description: `You created "${input.portfolio.name}"`,
    metadata: { portfolioId: input.portfolio.id },
  });

  for (const holding of input.holdings ?? []) {
    events.push({
      id: `holding-added-${holding.id}`,
      type: "holding_added",
      timestamp: holding.created_at,
      title: `Added ${holding.ticker}`,
      description: `Added ${holding.ticker} (${holding.asset_class}) to portfolio`,
      metadata: { ticker: holding.ticker, assetClass: holding.asset_class },
    });
  }

  for (const row of input.auditLog ?? []) {
    if (row.event_type === "FULL_EXIT" || row.event_type === "PARTIAL_SELL") {
      events.push({
        id: `holding-removed-${row.id}`,
        type: "holding_removed",
        timestamp: row.created_at,
        title: `Reduced ${row.ticker}`,
        description: `${row.event_type === "FULL_EXIT" ? "Removed" : "Sold part of"} ${row.ticker}`,
        metadata: { ticker: row.ticker, eventType: row.event_type },
      });
    }
  }

  for (const alert of input.driftAlerts ?? []) {
    const drift = Number(alert.drift_pct);
    events.push({
      id: `drift-alert-${alert.id}`,
      type: "drift_alert",
      timestamp: alert.detected_at,
      title: `Drift alert (${alert.metric})`,
      description: `Allocation drifted ${Number.isFinite(drift) ? drift.toFixed(1) : "—"}% from target`,
      metadata: { metric: alert.metric, driftPct: drift },
    });
  }

  for (const brief of input.briefs ?? []) {
    events.push({
      id: `brief-${brief.id}`,
      type: "brief_generated",
      timestamp: brief.generated_at,
      title: "AI portfolio brief generated",
      description: "Weekly portfolio analysis generated (historical record only)",
      metadata: { briefId: brief.id },
    });
  }

  const assumption = input.assumptions?.[0];
  if (assumption) {
    const ts = assumption.updated_at ?? assumption.created_at;
    if (ts) {
      events.push({
        id: `assumption-set-${assumption.id}`,
        type: "assumption_changed",
        timestamp: ts,
        title: "Factor weights configured",
        description: "Allocation engine factor weights set or updated for this portfolio",
      });
    }
  }

  return sortEventsChronologically(events);
}
