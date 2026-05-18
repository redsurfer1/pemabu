import { computePositionSentiment, type PositionSentiment } from "@/lib/intelligence/position-sentiment";

export interface CongressionalDisclosure {
  id: string;
  representative: string;
  party: string | null;
  state: string | null;
  ticker: string;
  asset_description: string | null;
  transaction_type: string | null;
  amount_range: string | null;
  transaction_date: string;
  filed_at_date: string | null;
}

export interface EnrichedCongressionalDisclosure extends CongressionalDisclosure {
  sentiment: PositionSentiment;
  priorExposure: number | null;
  exposure: number | null;
}

function repTickerKey(d: CongressionalDisclosure): string {
  return `${d.representative.trim()}|${d.ticker.toUpperCase()}`;
}

/** Parse midpoint from strings like "$1,001 - $15,000". */
export function parseAmountMidpoint(amountRange: string | null): number {
  if (!amountRange?.trim()) return 0;
  const values = [...amountRange.matchAll(/[\d,]+/g)]
    .map((m) => Number(m[0]!.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!;
  return (values[0]! + values[1]!) / 2;
}

export function transactionExposureDelta(
  transactionType: string | null,
  amountMidpoint: number,
): number {
  const t = (transactionType ?? "").toLowerCase();
  if (amountMidpoint <= 0) return 0;

  if (t.includes("sale") || t.includes("sell")) return -amountMidpoint;
  if (t.includes("purchase") || t.includes("buy")) return amountMidpoint;
  if (t.includes("exchange")) return 0;

  return 0;
}

/**
 * Adds position sentiment by comparing estimated net exposure after each trade
 * vs the prior trade for the same representative + ticker.
 */
export function enrichDisclosuresWithSentiment(
  history: CongressionalDisclosure[],
  targetRows?: CongressionalDisclosure[],
): EnrichedCongressionalDisclosure[] {
  const targets = targetRows ?? history;
  const targetIds = new Set(targets.map((r) => r.id));

  const byKey = new Map<string, CongressionalDisclosure[]>();
  for (const row of history) {
    const key = repTickerKey(row);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const enrichedById = new Map<string, EnrichedCongressionalDisclosure>();

  for (const list of byKey.values()) {
    list.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

    let netExposure = 0;
    for (const row of list) {
      const priorExposure = netExposure;
      const delta = transactionExposureDelta(row.transaction_type, parseAmountMidpoint(row.amount_range));
      netExposure = Math.max(0, netExposure + delta);

      if (targetIds.has(row.id)) {
        enrichedById.set(row.id, {
          ...row,
          priorExposure: priorExposure > 0 ? priorExposure : null,
          exposure: netExposure > 0 ? netExposure : null,
          sentiment: computePositionSentiment(netExposure, priorExposure),
        });
      }
    }
  }

  return targets
    .map((row) => enrichedById.get(row.id))
    .filter((r): r is EnrichedCongressionalDisclosure => Boolean(r));
}
