/** Legal routes — keep nav/footer links in sync. */
export const LEGAL_ROUTES = {
  terms: "/terms",
  privacy: "/privacy",
  disclaimer: "/disclaimer",
} as const;

/** Primary non-advisory statement — use in banners and short footers. */
export const NON_ADVISORY_HEADLINE =
  "Pemabu does not offer investment advice and is not a registered investment adviser or broker-dealer.";

/** Standard non-fiduciary disclaimer — keep in sync across AI brief, PDF, and product surfaces. */
export const NON_FIDUCIARY_FOOTER =
  "Pemabu is not a registered investment advisor. All outputs are for informational purposes only and do not constitute financial advice. " +
  "You retain full fiduciary responsibility for execution decisions.";

/** Compact banner copy for authenticated workspace chrome. */
export const WORKSPACE_DISCLAIMER_BANNER =
  "Not investment advice. Signals, scores, rankings, and AI-generated content are informational only. You are solely responsible for all investment and execution decisions.";

export const LEGAL_LAST_UPDATED = "May 16, 2026";

export const LEGAL_CONTACT_EMAIL = "contact@pemabu.com";
