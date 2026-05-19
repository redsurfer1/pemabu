const DEMO_STORAGE_KEY = "pemabu.demo.mode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") return true;
  } catch {}
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      try { localStorage.setItem(DEMO_STORAGE_KEY, "true"); } catch {}
      return true;
    }
  }
  return false;
}

export function enableDemoMode(): void {
  try { localStorage.setItem(DEMO_STORAGE_KEY, "true"); } catch {}
}

export function disableDemoMode(): void {
  try { localStorage.removeItem(DEMO_STORAGE_KEY); } catch {}
}

export const DEMO_SECTION_KEYS = [
  "defi_onchain",
  "governance_alerts",
  "options_overlay",
  "political_tracker",
  "vault_export",
  "macro_intelligence",
  "token_quality",
  "family_sharing",
  "scenario_sim",
  "morning_brief",
  "strategy_council",
] as const;

export type DemoSecionKey = (typeof DEMO_SECTION_KEYS)[number];
