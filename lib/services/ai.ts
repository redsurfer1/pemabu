// lib/services/ai.ts
// Single Anthropic gateway — all AI calls go here.
// Never call Anthropic SDK directly from API routes.
// SERVER-ONLY: never import from client components.

import Anthropic from "@anthropic-ai/sdk";
import type { AllocationWeight, Signal } from "@/lib/types/database";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-opus-4-5";
const MAX_TOKENS = 1024;

// ── Signal narrative ─────────────────────────────────

export async function generateSignalNarrative(input: {
  portfolioName: string;
  assetClass: string;
  targetPct: number;
  actualPct: number;
  driftPct: number;
  direction: "over" | "under";
}): Promise<string> {
  const prompt =
    `Portfolio: ${input.portfolioName}\n` +
    `Asset class: ${input.assetClass}\n` +
    `Target: ${input.targetPct}%\n` +
    `Actual: ${input.actualPct}%\n` +
    `Drift: ${Math.abs(input.driftPct)}% ` +
    `${input.direction} target\n\n` +
    `Write a concise 2-sentence plain-English explanation ` +
    `of this allocation drift for the portfolio owner. ` +
    `State what happened and why it may matter. ` +
    `No jargon. No recommendations. Facts only.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

// ── Weekly portfolio brief ───────────────────────────

export async function generatePortfolioBrief(input: {
  portfolioName: string;
  totalValue: number;
  currency: string;
  weights: AllocationWeight[];
  recentSignals: Signal[];
}): Promise<string> {
  const allocationSummary = input.weights
    .map(
      (w) =>
        `${w.asset_class}: ${w.actual_pct}% ` +
        `(target ${w.target_pct}%, ` +
        `drift ${w.drift_pct > 0 ? "+" : ""}` +
        `${w.drift_pct}%)`,
    )
    .join("\n");

  const signalSummary =
    input.recentSignals.length > 0
      ? input.recentSignals.map((s) => `- ${s.type}: ${s.title}`).join("\n")
      : "No active signals this week.";

  const prompt =
    `Portfolio: ${input.portfolioName}\n` +
    `Total value: ${input.currency} ` +
    `${input.totalValue.toLocaleString()}\n\n` +
    `Current allocation:\n${allocationSummary}\n\n` +
    `Recent signals:\n${signalSummary}\n\n` +
    `Write a concise weekly portfolio brief in 3-4 sentences. ` +
    `Summarize allocation status, note any significant drift, ` +
    `and highlight the most important signal if any. ` +
    `Plain English. No financial advice. ` +
    `Address the portfolio owner directly.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

// ── Holding explanation ──────────────────────────────

export async function explainHolding(input: {
  ticker: string;
  name: string | null;
  assetClass: string;
  currentPrice: number;
  quantity: number;
  currentValue: number;
  pctOfPortfolio: number;
}): Promise<string> {
  const prompt =
    `Ticker: ${input.ticker}` +
    `${input.name ? ` (${input.name})` : ""}\n` +
    `Asset class: ${input.assetClass}\n` +
    `Current price: $${input.currentPrice}\n` +
    `Quantity: ${input.quantity}\n` +
    `Position value: $${input.currentValue.toLocaleString()}\n` +
    `Portfolio weight: ${input.pctOfPortfolio}%\n\n` +
    `In 2-3 sentences, explain what this holding is ` +
    `and what role it typically plays in a portfolio. ` +
    `Plain English. No buy/sell recommendations.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}
