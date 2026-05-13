// lib/types/database.ts
// Hand-written types matching the Supabase schema
// Do not auto-generate — keep this in sync manually
// at beta scale (≤6 tables, easy to maintain)

export type UserRole = "owner" | "admin";

export type AssetClass =
  | "equity"
  | "fixed_income"
  | "alternatives"
  | "cash"
  | "crypto"
  | "other";

export type HoldingSource = "manual" | "upload" | "csv_import";

export type SignalType =
  | "drift"
  | "trend"
  | "brief"
  | "price_refresh_error"
  | "assumption_drift";

export type SignalSeverity = "info" | "warning" | "critical";

export type SignalStatus =
  | "unacknowledged"
  | "acknowledged"
  | "resolved";

export type DriftDirection = "over" | "under";

export type SnapshotTrigger =
  | "manual"
  | "nightly_cron"
  | "price_refresh"
  | "upload";

export interface UserProfile {
  id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: string;
  portfolio_id: string;
  ticker: string;
  name: string | null;
  asset_class: AssetClass;
  quantity: number;
  cost_basis: number | null;
  current_price: number | null;
  currency: string;
  source: HoldingSource;
  /** From nightly quote (e.g. +1.25 = +1.25%). */
  last_change_pct: number | null;
  /** User-entered expense ratio as decimal fraction (0.0003 = 0.03%). */
  expense_ratio: number | null;
  /** User-entered target weight as percent (20 = 20%). */
  target_weight_pct: number | null;
  last_price_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Signal {
  id: string;
  portfolio_id: string;
  holding_id: string | null;
  type: SignalType;
  severity: SignalSeverity;
  status: SignalStatus;
  title: string;
  message: string | null;
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DriftEvent {
  id: string;
  portfolio_id: string;
  holding_id: string;
  signal_id: string | null;
  asset_class: string;
  target_pct: number;
  actual_pct: number;
  threshold_pct: number;
  direction: DriftDirection;
  detected_at: string;
}

export interface AllocationSnapshot {
  id: string;
  portfolio_id: string;
  snapshot_data: Record<string, unknown>;
  total_value: number | null;
  currency: string;
  triggered_by: SnapshotTrigger;
  created_at: string;
}

// ─────────────────────────────────────────────────
// Pricing & Subscription types
// Catalog rows and keys must match lib/constants/services.ts (PEMABU_SERVICES).
// ─────────────────────────────────────────────────

export type PricingModel = "one_time" | "annual" | "per_event" | "free";

export type ServiceCategory = "core" | "subscription" | "addon" | "upgrade" | "overage";

export type SubscriptionGroup = "beta" | "standard" | "trial" | "alumni";

export type SubscriptionStatus = "active" | "cancelled" | "expired" | "complimentary" | "trial";

export interface PemabuService {
  id: string;
  service_key: string;
  display_name: string;
  description: string | null;
  category: ServiceCategory;
  pricing_model: PricingModel;
  price_usd: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  service_key: string;
  status: SubscriptionStatus;
  price_paid_usd: number | null;
  granted_by: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from pemabu_services */
  service?: PemabuService;
}

export interface UserGroupAssignment {
  id: string;
  user_id: string;
  subscription_group: SubscriptionGroup;
  assigned_by: string | null;
  assigned_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────
// Derived / computed types used in the application layer

export interface AllocationWeight {
  asset_class: AssetClass;
  target_pct: number;
  actual_pct: number;
  drift_pct: number;
  value_usd: number;
}

export interface PortfolioSummary {
  portfolio: Portfolio;
  total_value: number;
  holdings_count: number;
  top_signal: Signal | null;
  allocation: AllocationWeight[];
  last_snapshot_at: string | null;
}
