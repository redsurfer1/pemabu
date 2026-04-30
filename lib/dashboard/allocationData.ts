export const ALLOCATION_RING = [
  {
    label: "Equity",
    pct: "38%",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.2)",
    desc: "Global equities, growth assets",
  },
  {
    label: "Fixed Income",
    pct: "28%",
    color: "#C9A84C",
    bg: "rgba(201,168,76,0.08)",
    border: "rgba(201,168,76,0.2)",
    desc: "Bonds, sovereign & corporate",
  },
  {
    label: "Alternatives",
    pct: "22%",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
    desc: "Real assets, private equity",
  },
  {
    label: "Cash & Other",
    pct: "12%",
    color: "#6B7280",
    bg: "rgba(107,114,128,0.08)",
    border: "rgba(107,114,128,0.2)",
    desc: "Liquidity reserves, hedges",
  },
  {
    label: "Crypto",
    pct: "0%",
    color: "#F7931A",
    bg: "rgba(247,147,26,0.08)",
    border: "rgba(247,147,26,0.2)",
    desc: "Bitcoin, Ethereum, DeFi & altcoins",
  },
] as const;

export const DASHBOARD_NAV_TABS = [
  "Dashboard",
  "Workbook",
  "Signals",
  "Admin",
] as const;
