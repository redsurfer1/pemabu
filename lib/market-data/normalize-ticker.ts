const CRYPTO_SUFFIXES = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "AVAX",
  "DOT",
  "MATIC",
  "LINK",
  "UNI",
  "LTC",
  "DOGE",
  "SHIB",
  "ARB",
  "OP",
  "APT",
  "SUI",
  "ATOM",
  "NEAR",
  "FTM",
  "INJ",
  "TIA",
  "SEI",
  "STX",
  "IMX",
  "SAND",
  "MANA",
  "AXS",
  "GRT",
  "AAVE",
  "CRV",
  "MKR",
  "SNX",
  "COMP",
  "YFI",
  "SUSHI",
  "BAL",
  "FXS",
  "LDO",
  "RPL",
  "GMX",
  "PENDLE",
  "JTO",
  "WIF",
  "BONK",
  "PEPE",
  "FLOKI",
];

/** Normalize user tickers for Tiingo (equity symbols + crypto as BASE-USD). */
export function normalizeTicker(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t === "CASH") return "CASH";
  if (t.endsWith("-USD") || t.endsWith("-USDT") || t.endsWith("-BTC")) return t;
  if (CRYPTO_SUFFIXES.includes(t)) return `${t}-USD`;
  return t;
}
