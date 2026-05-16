/**
 * Intelligence-tier capabilities that are not separate billable SKUs.
 * Shown in dashboard services sidebar and pricing "included with Intelligence".
 */
export const INTELLIGENCE_FEATURES = [
  {
    feature_key: "intelligence_13f_overlay",
    display_name: "13F Institutional Overlay",
    description:
      "Recent hedge fund 13F-HR filings for any ticker via SEC EDGAR — included with Pemabu Intelligence and Autonomous.",
    route: "/intelligence/13f-overlay",
  },
] as const;

export type IntelligenceFeatureKey = (typeof INTELLIGENCE_FEATURES)[number]["feature_key"];
