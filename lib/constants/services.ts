/**
 * Canonical Pemabu service catalog, tier rules, and pricing ladder.
 * Single source of truth — import from here; do not duplicate prices or keys.
 */

import type { SubscriptionStatus } from "@/lib/types/database";

export const PEMABU_SERVICES = [
  {
    service_key: "core_free",
    display_name: "Pemabu Core (Free)",
    category: "core",
    pricing_model: "free",
    price_usd: 0,
    description:
      "Local-first allocation workspace: one portfolio, manual entry only, no exchange sync, no Watcher automation. Upgrade to Intelligence for feeds, Watcher, and blueprint import.",
  },
  {
    service_key: "core_v1",
    display_name: "Pemabu Core v1",
    category: "core",
    pricing_model: "one_time",
    price_usd: 199.0,
    description:
      "Perpetual license for v1.x. Full local allocation engine, single portfolio, offline capable. All v1.x point releases free. Major version upgrade (v1 → v2) is a separate one-time fee.",
  },
  {
    service_key: "intelligence_annual",
    display_name: "Pemabu Intelligence",
    category: "subscription",
    pricing_model: "annual",
    price_usd: 229.0,
    description:
      "Multi-account (up to 10 portfolios), real-time price feeds, Watcher Agent (4-hour cycle), WebSocket Live Broadcast, political trade overlay, hedge fund 13F overlay, morning brief, scenario simulation (20 included/month).",
  },
  {
    service_key: "autonomous_annual",
    display_name: "Pemabu Autonomous",
    category: "subscription",
    pricing_model: "annual",
    price_usd: 899.0,
    description:
      "Everything in Intelligence plus: WebRTC P2P broadcast, fiat and crypto execution (Alpaca, Kraken, Coinbase), trade approval queue, configurable guardrails, immutable audit ledger, tax lot tracking, bidirectional browser control, emergency stop. Unlimited scenario simulations.",
  },
  {
    service_key: "scenario_sim_overage",
    display_name: "Scenario Simulation (overage)",
    category: "overage",
    pricing_model: "per_event",
    price_usd: 0.5,
    description:
      "Per simulation beyond the Intelligence soft cap of 20/month. Autonomous tier has unlimited simulations included.",
  },
  {
    service_key: "v1_to_v2_upgrade",
    display_name: "Core v1 → v2 Upgrade",
    category: "upgrade",
    pricing_model: "one_time",
    price_usd: 99.0,
    description:
      "One-time upgrade fee for existing Core v1 perpetual license holders to access v2. New v2 purchasers pay full v2 price ($249). Available Year 2+.",
  },
  {
    service_key: "addon_defi_onchain",
    display_name: "DeFi + On-Chain",
    category: "addon",
    pricing_model: "annual",
    price_usd: 49.0,
    description:
      "Read-only wallet connect, staking position tracker, LP position tracker with impermanent loss calculator.",
  },
  {
    service_key: "addon_macro_intelligence",
    display_name: "Macro Intelligence",
    category: "addon",
    pricing_model: "annual",
    price_usd: 39.0,
    description:
      "Weekly macro regime classification, regime-adjusted assumption suggestions, cross-asset correlation heatmap.",
  },
  {
    service_key: "addon_options_overlay",
    display_name: "Options Overlay",
    category: "addon",
    pricing_model: "annual",
    price_usd: 59.0,
    description:
      "Track covered calls and puts, P&L on options positions, delta-adjusted portfolio exposure view.",
  },
  {
    service_key: "addon_family_sharing",
    display_name: "Family Sharing",
    category: "addon",
    pricing_model: "annual",
    price_usd: 49.0,
    description:
      "Read-only consolidated dashboard shared with spouse or partner. No execution access. No portfolio data leaves the local device.",
  },
  {
    service_key: "addon_data_vault_export",
    display_name: "Data Vault Export",
    category: "addon",
    pricing_model: "annual",
    price_usd: 19.0,
    description:
      "Automated weekly encrypted backup of all local Pemabu data to user-owned cloud storage (S3, Backblaze, or local NAS).",
  },
  {
    service_key: "addon_governance_alerts",
    display_name: "Governance Alert Layer",
    category: "addon",
    pricing_model: "annual",
    price_usd: 39.0,
    description:
      "Monitor governance forums for tokens held in portfolio. Plain-English proposal summaries surfaced as Watcher Agent signals.",
  },
  {
    service_key: "addon_political_tracker",
    display_name: "Political Trade Tracker",
    category: "addon",
    pricing_model: "annual",
    price_usd: 29.0,
    description:
      "Congressional disclosure filings surfaced as signals when overlapping with portfolio holdings.",
  },
  {
    service_key: "addon_token_quality",
    display_name: "Token Quality Score",
    category: "addon",
    pricing_model: "annual",
    price_usd: 29.0,
    description:
      "Token Transparency Framework scoring (18 criteria) surfaced as an optional composite factor weight in the allocation engine.",
  },
  {
    service_key: "live_broadcast_addon",
    display_name: "Live Broadcast",
    category: "addon",
    pricing_model: "annual",
    price_usd: 79.0,
    description:
      "WebSocket relay broadcast for Core-only users. View a single portfolio from any browser via secure session token. Included in Intelligence and Autonomous tiers.",
  },
] as const;

export type PemabuServiceKey = (typeof PEMABU_SERVICES)[number]["service_key"];

export const CANONICAL_SERVICE_KEYS = PEMABU_SERVICES.map((s) => s.service_key) as PemabuServiceKey[];

/** Services INCLUDED in each tier at no extra charge */
export const TIER_INCLUSIONS = {
  core_free: ["core_free"],
  core_v1: ["core_v1"],
  intelligence_annual: [
    "intelligence_annual",
    "live_broadcast_addon",
    "addon_political_tracker",
  ],
  autonomous_annual: ["autonomous_annual", "live_broadcast_addon", "addon_political_tracker"],
} as const;

export const SCENARIO_SIM_SOFT_CAP = {
  intelligence_annual: 20,
  autonomous_annual: Number.POSITIVE_INFINITY,
  core_v1: 0,
  core_free: 0,
} as const;

/**
 * Decoy pricing ladder — Intelligence is the rational upgrade vs Core + Live Broadcast.
 */
export const PRICING_LADDER = {
  core_free: { price: 0, model: "free" as const },
  core_v1: { price: 199, model: "one_time" as const },
  intelligence_annual: { price: 229, model: "annual" as const },
  autonomous_annual: { price: 899, model: "annual" as const },
  live_broadcast_addon: { price: 79, model: "annual" as const, decoy: true as const },
  v1_to_v2_upgrade: { price: 99, model: "one_time" as const, available: "year_2_plus" as const },
} as const;

export const SUBSCRIPTION_GROUPS = {
  beta: {
    label: "Beta",
    description:
      "Full access to all active services at no charge. Perpetual while active.",
    access: "all_services_complimentary",
    price_paid: null,
    expires_at: null,
  },
  standard: {
    label: "Standard",
    description: "Pays market price per service. No complimentary access.",
    access: "per_service",
  },
  trial: {
    label: "Trial",
    description: "30-day full access. No payment required.",
    access: "all_services_trial",
    expires_at: "30_days_from_start",
  },
  alumni: {
    label: "Alumni",
    description:
      "Former beta user. Market price applies. Complimentary subscriptions cancelled.",
    access: "per_service",
  },
} as const;

/** DB `user_subscriptions.status` values that grant service access */
export function isSubscriptionRowAccessActive(
  status: SubscriptionStatus | string,
): boolean {
  return (
    status === "active" ||
    status === "complimentary" ||
    status === "trial"
  );
}

/** Tier key → list of included service keys (no extra charge) */
export function tierIncludedServiceKeys(
  tier: keyof typeof TIER_INCLUSIONS,
): readonly string[] {
  return TIER_INCLUSIONS[tier];
}
