/** Marketplace blueprint unlock — integer cents only ($4.99 = 499). */
export const MARKETPLACE_UNLOCK_PRICE_CENTS = 499;
/** Developer royalty share of gross (70%). */
export const CREATOR_ROYALTY_NUMERATOR = 70;
export const CREATOR_ROYALTY_DENOMINATOR = 100;

export function splitUnlockSale(pricePaidCents: number): {
  creatorPayoutCents: number;
  platformFeeCents: number;
  creatorRoyaltyPct: number;
} {
  const gross = Math.max(0, Math.floor(pricePaidCents));
  const creatorPayoutCents = Math.floor((gross * CREATOR_ROYALTY_NUMERATOR) / CREATOR_ROYALTY_DENOMINATOR);
  const platformFeeCents = gross - creatorPayoutCents;
  const creatorRoyaltyPct = CREATOR_ROYALTY_NUMERATOR / CREATOR_ROYALTY_DENOMINATOR;
  return { creatorPayoutCents, platformFeeCents, creatorRoyaltyPct };
}
