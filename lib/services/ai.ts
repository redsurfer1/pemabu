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
const STRATEGY_COUNCIL_MODEL = process.env.STRATEGY_COUNCIL_ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
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
    `Summarize the current allocation status, note any asset classes with ` +
    `significant drift from target, and highlight the most critical signal if any. ` +
    `Use plain English. Do not include investment advice, buy/sell recommendations, ` +
    `or predictions about future performance. ` +
    `Address the portfolio owner directly (use "your portfolio"). ` +
    `End with exactly this disclaimer on its own line: ` +
    `"This brief is for informational purposes only and does not constitute financial advice."`;

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

/** DeFi governance proposal summary — call only from server actions / API routes after user opt-in. */
export async function generateGovernanceProposalSummary(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  return content.type === "text" ? content.text.trim() : "";
}

// ── Strategy Council (Autonomous; explicit user trigger only) ──

export type StrategyCouncilPdfSection = {
  id: string;
  heading: string;
  bodyMarkdown: string;
};

export type StrategyCouncilMemoPayload = {
  markdown: string;
  pdfLayout: {
    documentTitle: string;
    sections: StrategyCouncilPdfSection[];
  };
};

/**
 * Sovereign Strategy Council monthly memo — call only after explicit user action.
 * `contextPacketJson` must be the sanitized Institutional Memory JSON (no automated batching).
 */
export async function generateStrategyCouncilMonthlyMemo(contextPacketJson: string): Promise<StrategyCouncilMemoPayload> {
  const prompt =
    `You are acting as a sovereign portfolio protocol analyst. You will receive a single JSON object ` +
    `"Institutional Memory" for one portfolio window (aggregates only; no free-form PII). ` +
    `Provide a professional, stoic, and data-driven assessment of the month's activity.\n\n` +
    `Institutional Memory JSON:\n${contextPacketJson}\n\n` +
    `Respond with ONLY valid JSON (no markdown code fences, no prose outside JSON) in this exact shape:\n` +
    `{"fullMarkdown": string, "pdfLayout": {"documentTitle": string, "sections": [` +
    `{"id":"executive","heading":"Executive Summary","bodyMarkdown": string},` +
    `{"id":"discipline","heading":"Discipline Report","bodyMarkdown": string},` +
    `{"id":"macro","heading":"Macro-Tilt Suggestions","bodyMarkdown": string}` +
    `]}}\n\n` +
    `Requirements:\n` +
    `- fullMarkdown: concatenation of the three sections with ## headings, suitable for dashboard display.\n` +
    `- Each bodyMarkdown: substantive paragraphs; no sensational language; no personalized legal or tax advice.\n` +
    `- Macro-Tilt: suggest rebalancing themes informed by drift aggregates and execution stats only.\n` +
    `- If data gaps are noted in the JSON, acknowledge uncertainty briefly.`;

  const message = await anthropic.messages.create({
    model: STRATEGY_COUNCIL_MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  const raw = content.type === "text" ? content.text.trim() : "{}";
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: {
    fullMarkdown?: string;
    pdfLayout?: { documentTitle?: string; sections?: StrategyCouncilPdfSection[] };
  };
  try {
    parsed = JSON.parse(stripped) as typeof parsed;
  } catch {
    return {
      markdown: raw,
      pdfLayout: {
        documentTitle: "Strategy Council — Monthly Memo",
        sections: [
          {
            id: "executive",
            heading: "Executive Summary",
            bodyMarkdown: "_Model returned non-JSON; raw output preserved._",
          },
        ],
      },
    };
  }

  const pdfLayout = {
    documentTitle: parsed.pdfLayout?.documentTitle ?? "Strategy Council — Monthly Memo",
    sections:
      parsed.pdfLayout?.sections?.length === 3
        ? parsed.pdfLayout.sections
        : [
            {
              id: "executive",
              heading: "Executive Summary",
              bodyMarkdown: parsed.fullMarkdown ?? "_No structured sections._",
            },
          ],
  };

  return {
    markdown:
      parsed.fullMarkdown ?? pdfLayout.sections.map((s) => `## ${s.heading}\n\n${s.bodyMarkdown}`).join("\n\n"),
    pdfLayout,
  };
}
