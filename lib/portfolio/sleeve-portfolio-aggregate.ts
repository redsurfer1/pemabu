import { d, positionMarketValue, valueWeightedAverage } from "@/lib/portfolio/precision-money";
import type Decimal from "decimal.js";

export interface SleeveHoldingSlice {
  id: string;
  ticker: string;
  qty: string | number;
  /** Current or seed price per share */
  price: string | number;
  rsi14?: string | number | null;
}

export interface SleeveSlice {
  id: string;
  name?: string;
  holdings: readonly SleeveHoldingSlice[];
}

export interface PortfolioSlice {
  id: string;
  sleeves: readonly SleeveSlice[];
}

export interface SleeveRollup {
  sleeveId: string;
  totalValue: Decimal;
  weightInPortfolio: Decimal;
  valueWeightedRsi: Decimal | null;
}

export interface PortfolioRollup {
  portfolioId: string;
  totalValue: Decimal;
  sleeves: SleeveRollup[];
  portfolioRsi: Decimal | null;
}

export function rollupPortfolio(input: PortfolioSlice): PortfolioRollup {
  const sleeveRollups: SleeveRollup[] = [];
  let portfolioTotal = d(0);

  for (const sleeve of input.sleeves) {
    let sleeveTotal = d(0);
    const rsiPairs: { value: Decimal; reading: Decimal }[] = [];

    for (const h of sleeve.holdings) {
      const mv = positionMarketValue(h.qty, h.price);
      sleeveTotal = sleeveTotal.plus(mv);
      if (h.rsi14 !== undefined && h.rsi14 !== null && `${h.rsi14}`.length > 0) {
        rsiPairs.push({ value: mv, reading: d(String(h.rsi14)) });
      }
    }

    portfolioTotal = portfolioTotal.plus(sleeveTotal);
    const sleeveRsi = valueWeightedAverage(rsiPairs);

    sleeveRollups.push({
      sleeveId: sleeve.id,
      totalValue: sleeveTotal,
      weightInPortfolio: d(0),
      valueWeightedRsi: sleeveRsi,
    });
  }

  for (const sr of sleeveRollups) {
    sr.weightInPortfolio = portfolioTotal.isZero()
      ? d(0)
      : sr.totalValue.div(portfolioTotal);
  }

  const portRsiPairs = sleeveRollups
    .filter((s) => s.valueWeightedRsi !== null)
    .map((s) => ({
      value: s.totalValue,
      reading: s.valueWeightedRsi as Decimal,
    }));

  return {
    portfolioId: input.id,
    totalValue: portfolioTotal,
    sleeves: sleeveRollups,
    portfolioRsi: valueWeightedAverage(portRsiPairs),
  };
}

/** Multi-portfolio ring inputs: each sleeve budget vs realized sleeve NAV share. */
export function consolidatedSleeveBudgetRing(
  portfolios: readonly PortfolioSlice[],
  sleeveBudgetPct: (portfolioId: string, sleeveId: string) => Decimal.Value,
): { portfolioId: string; sleeveId: string; budgetPct: Decimal; navSharePct: Decimal; gapPct: Decimal }[] {
  const rolls = portfolios.map((p) => rollupPortfolio(p));
  const grand = rolls.reduce((sum, r) => sum.plus(r.totalValue), d(0));
  const rows: {
    portfolioId: string;
    sleeveId: string;
    budgetPct: Decimal;
    navSharePct: Decimal;
    gapPct: Decimal;
  }[] = [];

  for (let i = 0; i < portfolios.length; i++) {
    const p = portfolios[i];
    const roll = rolls[i];
    for (const s of roll.sleeves) {
      const budget = d(sleeveBudgetPct(p.id, s.sleeveId));
      const navShare = grand.isZero() ? d(0) : s.totalValue.div(grand);
      rows.push({
        portfolioId: p.id,
        sleeveId: s.sleeveId,
        budgetPct: budget,
        navSharePct: navShare,
        gapPct: navShare.minus(budget),
      });
    }
  }

  return rows;
}
