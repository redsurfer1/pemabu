// MACRO REGIME CLASSIFICATION ENGINE

export type MacroRegime = "risk_on" | "risk_off" | "stagflation" | "deflation";

export interface MacroIndicators {
  vix: number;
  yield10y: number;
  yield2y: number;
  dxy: number;
  goldPct30d: number;
  btcPct30d: number;
  sp500Pct30d: number;
}

export interface RegimeClassification {
  regime: MacroRegime;
  confidencePct: number;
  indicators: MacroIndicators;
  suggestedWeights: {
    hist3mo: number;
    hist6mo: number;
    hist1yr: number;
    hist3yr: number;
    hist5yr: number;
  };
  rationale: string;
}

interface RegimeScores {
  risk_on: number;
  risk_off: number;
  stagflation: number;
  deflation: number;
}

function scoreIndicators(ind: MacroIndicators): RegimeScores {
  const scores: RegimeScores = {
    risk_on: 0,
    risk_off: 0,
    stagflation: 0,
    deflation: 0,
  };

  if (ind.vix < 15) {
    scores.risk_on += 3;
  }
  if (ind.vix > 25) {
    scores.risk_off += 3;
    scores.deflation += 1;
  }
  if (ind.vix > 35) {
    scores.risk_off += 2;
  }

  const yieldSpread = ind.yield10y - ind.yield2y;
  if (yieldSpread > 0.5) {
    scores.risk_on += 2;
  }
  if (yieldSpread < 0) {
    scores.deflation += 3;
    scores.risk_off += 1;
  }
  if (yieldSpread < -0.5) {
    scores.deflation += 2;
  }

  if (ind.yield10y > 4.5) {
    scores.stagflation += 3;
  }
  if (ind.yield10y > 5.0) {
    scores.stagflation += 2;
  }
  if (ind.yield10y < 2.5) {
    scores.deflation += 2;
  }

  if (ind.dxy > 106) {
    scores.risk_off += 2;
    scores.stagflation += 1;
  }
  if (ind.dxy < 99) {
    scores.risk_on += 2;
  }

  if (ind.goldPct30d > 3) {
    scores.risk_off += 2;
    scores.stagflation += 1;
  }
  if (ind.goldPct30d > 6) {
    scores.risk_off += 1;
  }
  if (ind.goldPct30d < -2) {
    scores.risk_on += 1;
  }

  if (ind.btcPct30d > 10) {
    scores.risk_on += 2;
  }
  if (ind.btcPct30d < -15) {
    scores.risk_off += 2;
  }

  if (ind.sp500Pct30d > 3) {
    scores.risk_on += 3;
  }
  if (ind.sp500Pct30d < -5) {
    scores.risk_off += 2;
    scores.deflation += 1;
  }
  if (ind.sp500Pct30d < -10) {
    scores.risk_off += 2;
  }

  return scores;
}

const REGIME_WEIGHT_SUGGESTIONS: Record<
  MacroRegime,
  { hist3mo: number; hist6mo: number; hist1yr: number; hist3yr: number; hist5yr: number }
> = {
  risk_on: { hist3mo: 30, hist6mo: 25, hist1yr: 20, hist3yr: 15, hist5yr: 10 },
  risk_off: { hist3mo: 10, hist6mo: 15, hist1yr: 25, hist3yr: 25, hist5yr: 25 },
  stagflation: { hist3mo: 15, hist6mo: 20, hist1yr: 30, hist3yr: 25, hist5yr: 10 },
  deflation: { hist3mo: 10, hist6mo: 10, hist1yr: 20, hist3yr: 30, hist5yr: 30 },
};

const REGIME_RATIONALE: Record<MacroRegime, string> = {
  risk_on:
    "Growth indicators are positive. Recent momentum is the strongest signal. " +
    "Assumptions weighted toward 3-month and 6-month history.",
  risk_off:
    "Risk aversion is elevated. Short-term returns are noise in a fear environment. " +
    "Assumptions weighted toward 3-year and 5-year mean reversion.",
  stagflation:
    "Inflation is running above trend while growth is decelerating. " +
    "Mixed signals favour medium-term (1-year) as the anchor assumption.",
  deflation:
    "Yield curve inversion and negative growth signals indicate contraction risk. " +
    "Assumptions heavily weighted toward long-term recovery baselines.",
};

const REGIME_ORDER: MacroRegime[] = ["risk_on", "risk_off", "stagflation", "deflation"];

export function classifyMacroRegime(indicators: MacroIndicators): RegimeClassification {
  const scores = scoreIndicators(indicators);
  let regime: MacroRegime = "risk_on";
  let best = -1;
  for (const r of REGIME_ORDER) {
    const s = scores[r];
    if (s > best) {
      best = s;
      regime = r;
    }
  }
  const total = REGIME_ORDER.reduce((a, r) => a + scores[r], 0);
  const confidencePct =
    total > 0 ? Math.min(100, Math.max(0, Math.round((scores[regime] / total) * 100))) : 25;

  return {
    regime,
    confidencePct,
    indicators,
    suggestedWeights: REGIME_WEIGHT_SUGGESTIONS[regime],
    rationale: REGIME_RATIONALE[regime],
  };
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dxi = x[i]! - mx;
    const dyi = y[i]! - my;
    num += dxi * dyi;
    dx2 += dxi * dxi;
    dy2 += dyi * dyi;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}
