// lib/portfolio/sovereign-score-pipeline.ts
//
// Populates sovereign holding scores from available data sources.
// Called during portfolio refresh (app/api/portfolio/[portfolioId]/refresh/route.ts).
//
// Score sources (in priority order):
//   score_token_quality: TTF composite from lib/token-quality/ttf-scorer.ts
//                        — computed for crypto holdings via CoinGecko public API
//   score_thirteen_f:    stub — manual entry only until 13F parser is implemented
//   score_macro_intelligence: stub — future macro regime integration
//   score_governance_layer:   stub — future governance data integration
//   score_political_tracker:  stub — future country/political risk integration
//
// Only score_token_quality is computed automatically. The other four columns
// retain whatever value the user has manually entered (or null).

import { scoreTicker } from "@/lib/token-quality/ttf-scorer";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SovereignScoreHolding {
  id: string;
  ticker: string;
  /** Determines which scores are applicable (crypto → TTF eligible) */
  asset_class: string;
}

/**
 * Partial score update for a single holding.
 * Only fields present in the object are written; null preserves the DB null.
 */
export interface SovereignScoreUpdate {
  score_token_quality?: number | null;
  // score_thirteen_f, score_macro_intelligence, score_governance_layer,
  // score_political_tracker intentionally omitted here — manually entered only.
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Computes and persists sovereign scores for a list of holdings.
 *
 * Currently computes:
 *   score_token_quality — TTF composite score (0–100) for crypto holdings.
 *     Uses CoinGecko public API (no key required). Rate limit: ~10–30 req/min.
 *     If CoinGecko is unavailable or the token is not found, the existing
 *     score_token_quality value is left unchanged (non-fatal).
 *
 * Holdings without 'crypto' asset_class are skipped — their score_token_quality
 * column is not touched.
 *
 * @param portfolioId Portfolio UUID (used for logging context only)
 * @param holdings    Array of holdings to score; only `id`, `ticker`,
 *                    and `asset_class` are required
 */
export async function runSovereignScorePipeline(
  portfolioId: string,
  holdings: SovereignScoreHolding[],
): Promise<void> {
  const updates: Array<{ id: string; scores: SovereignScoreUpdate }> = [];

  for (const holding of holdings) {
    const scores: SovereignScoreUpdate = {};

    // TTF composite score — only applicable to crypto holdings
    if (holding.asset_class === "crypto") {
      try {
        const result = await scoreTicker(holding.ticker);
        scores.score_token_quality = result.composite_score;
      } catch {
        // Non-fatal — network error, rate limit, or unknown token.
        // Leave the existing score_token_quality value unchanged.
        console.warn(
          `[sovereign-pipeline] TTF score failed for ${holding.ticker} ` +
          `(portfolio ${portfolioId}) — skipping`,
        );
      }
    }

    // Stubs for future data sources (populated by their own pipeline steps
    // once implemented — do not overwrite with null here):
    //   scores.score_thirteen_f          — 13F parser (manual entry for now)
    //   scores.score_macro_intelligence  — macro regime weights (future)
    //   scores.score_governance_layer    — governance data (future)
    //   scores.score_political_tracker   — country risk (future)

    if (Object.keys(scores).length > 0) {
      updates.push({ id: holding.id, scores });
    }
  }

  if (updates.length === 0) return;

  // Batch update: one Supabase call per holding that has a score update.
  // In practice this is only crypto holdings; equities/cash are skipped.
  await Promise.allSettled(
    updates.map(({ id, scores }) =>
      supabaseAdmin
        .from("portfolio_holdings")
        .update(scores)
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.warn(
              `[sovereign-pipeline] Failed to persist score for holding ${id}: ${error.message}`,
            );
          }
        }),
    ),
  );
}
