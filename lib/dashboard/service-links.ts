import { PEMABU_SERVICES } from "@/lib/constants/services";

/** Primary in-app route per service (view / use). Falls back to upgrade gate. */
export const SERVICE_APP_ROUTES: Partial<Record<string, string>> = {
  core_v1: "/portfolio/engine",
  intelligence_annual: "/portfolio/engine",
  autonomous_annual: "/portfolio/engine",
  scenario_sim_overage: "/scenario-sim",
  v1_to_v2_upgrade: "/upgrade?service=v1_to_v2_upgrade",
  addon_defi_onchain: "/defi",
  addon_macro_intelligence: "/macro",
  addon_options_overlay: "/options",
  addon_family_sharing: "/family",
  addon_data_vault_export: "/vault-export",
  addon_governance_alerts: "/governance",
  addon_political_tracker: "/political-tracker",
  addon_token_quality: "/token-quality",
  live_broadcast_addon: "/broadcast",
  marketplace_import_token: "/marketplace",
};

export function serviceHref(serviceKey: string): string {
  return SERVICE_APP_ROUTES[serviceKey] ?? `/upgrade?service=${encodeURIComponent(serviceKey)}`;
}

export function servicePriceLabel(serviceKey: string): string {
  const row = PEMABU_SERVICES.find((s) => s.service_key === serviceKey);
  if (!row) return "";
  if (row.pricing_model === "one_time") return `$${row.price_usd}`;
  if (row.pricing_model === "annual") return `$${row.price_usd}/yr`;
  if (row.pricing_model === "per_event") return `$${row.price_usd}/ea`;
  return `$${row.price_usd}`;
}

export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  subscription: "Subscriptions",
  addon: "Add-ons",
  overage: "Usage",
  upgrade: "Upgrades",
};

export const DASHBOARD_SERVICE_GROUPS = ["core", "subscription", "addon", "overage", "upgrade"] as const;
