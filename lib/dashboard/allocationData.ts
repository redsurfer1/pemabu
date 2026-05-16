import { ASSET_CLASS_COLORS } from "@/lib/constants/asset-classes";

/** Convert a #RRGGBB hex to an rgba() string. */
function hex2rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const ALLOCATION_RING = [
  {
    label: "Equity",
    pct: "38%",
    color: ASSET_CLASS_COLORS.equity,
    bg: hex2rgba(ASSET_CLASS_COLORS.equity, 0.08),
    border: hex2rgba(ASSET_CLASS_COLORS.equity, 0.2),
    desc: "Global equities, growth assets",
  },
  {
    label: "Fixed Income",
    pct: "28%",
    color: ASSET_CLASS_COLORS.fixed_income,
    bg: hex2rgba(ASSET_CLASS_COLORS.fixed_income, 0.08),
    border: hex2rgba(ASSET_CLASS_COLORS.fixed_income, 0.2),
    desc: "Bonds, sovereign & corporate",
  },
  {
    label: "Alternatives",
    pct: "22%",
    color: ASSET_CLASS_COLORS.alternatives,
    bg: hex2rgba(ASSET_CLASS_COLORS.alternatives, 0.08),
    border: hex2rgba(ASSET_CLASS_COLORS.alternatives, 0.2),
    desc: "Real assets, private equity",
  },
  {
    label: "Cash & Other",
    pct: "12%",
    color: ASSET_CLASS_COLORS.cash,
    bg: hex2rgba(ASSET_CLASS_COLORS.cash, 0.08),
    border: hex2rgba(ASSET_CLASS_COLORS.cash, 0.2),
    desc: "Liquidity reserves, hedges",
  },
  {
    label: "Crypto",
    pct: "0%",
    color: ASSET_CLASS_COLORS.crypto,
    bg: hex2rgba(ASSET_CLASS_COLORS.crypto, 0.08),
    border: hex2rgba(ASSET_CLASS_COLORS.crypto, 0.2),
    desc: "Bitcoin, Ethereum, DeFi & altcoins",
  },
];

export const DASHBOARD_NAV_TABS = [
  "Dashboard",
  "Workbook",
  "Signals",
  "Admin",
] as const;
