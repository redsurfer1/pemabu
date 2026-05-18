export type MemoryEventType =
  | "holding_added"
  | "holding_removed"
  | "assumption_changed"
  | "drift_alert"
  | "brief_generated"
  | "portfolio_created";

export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  timestamp: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PortfolioMemorySummary {
  totalEvents: number;
  holdingsAdded: number;
  driftAlertsReceived: number;
  briefsGenerated: number;
}

export interface PortfolioMemoryResponse {
  portfolioId: string;
  portfolioName: string;
  createdAt: string;
  daysSinceCreation: number;
  summary: PortfolioMemorySummary;
  events: MemoryEvent[];
  notice: string;
  limitations: string[];
}
