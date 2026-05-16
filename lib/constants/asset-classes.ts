// lib/constants/asset-classes.ts
// Canonical asset class registry — single source of truth for labels, colors, and Zod enum.
// Import ASSET_CLASS_ENUM in place of inline z.enum([...]) repetition.
// Import ASSET_CLASS_COLORS for allocation ring / donut chart segments.

import { z } from "zod";
import type { AssetClass } from "@/lib/types/database";

/** All valid asset classes in display order. Matches AssetClass union in lib/types/database.ts. */
export const ASSET_CLASSES: readonly AssetClass[] = [
  "equity",
  "fixed_income",
  "alternatives",
  "cash",
  "crypto",
  "other",
] as const;

/** Human-readable labels for each asset class. */
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity:       "Equity",
  fixed_income: "Fixed Income",
  alternatives: "Alternatives",
  cash:         "Cash",
  crypto:       "Crypto",
  other:        "Other",
};

/**
 * Hex colors for allocation ring / donut chart segments.
 * crypto: #F7931A is the canonical Bitcoin orange used across Pemabu's crypto branding.
 * All other colors follow the Pemabu dark-theme palette.
 */
export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equity:       "#4F8EF7", // blue
  fixed_income: "#10B981", // emerald
  alternatives: "#8B5CF6", // purple
  cash:         "#6B7280", // slate
  crypto:       "#F7931A", // Bitcoin orange
  other:        "#9CA3AF", // gray
};

/**
 * Zod enum for validating asset_class fields in API request schemas.
 * Use this instead of repeating the literal tuple in every route.
 *
 * @example
 * const Schema = z.object({
 *   asset_class: ASSET_CLASS_ENUM,
 * });
 */
export const ASSET_CLASS_ENUM = z.enum([
  "equity",
  "fixed_income",
  "alternatives",
  "cash",
  "crypto",
  "other",
]);

export type AssetClassEnum = z.infer<typeof ASSET_CLASS_ENUM>;

/** Returns true for the given string if it is a valid AssetClass value. */
export function isValidAssetClass(value: string): value is AssetClass {
  return (ASSET_CLASSES as readonly string[]).includes(value);
}
