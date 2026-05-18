// $4.99 per import token / per blueprint unlock
// Stripe price IDs for bundles live in env — see create-import-token-checkout route.

/** Marketplace blueprint unlock — integer cents only ($4.99 = 499). */
export const MARKETPLACE_UNLOCK_PRICE_CENTS = 499;

/** Standard developer royalty share of gross (70%). */
export const STANDARD_CREATOR_ROYALTY_NUMERATOR = 70;
export const STANDARD_CREATOR_ROYALTY_DENOMINATOR = 100;

/** Founding publisher royalty share (80%). */
export const FOUNDING_CREATOR_ROYALTY_NUMERATOR = 80;
export const FOUNDING_CREATOR_ROYALTY_DENOMINATOR = 100;

export const FOUNDING_PUBLISHER_CAP = 50;

export function splitUnlockSale(
  pricePaidCents: number,
  options?: { isFoundingPublisher?: boolean },
): {
  creatorPayoutCents: number;
  platformFeeCents: number;
  creatorRoyaltyPct: number;
} {
  const gross = Math.max(0, Math.floor(pricePaidCents));
  const num = options?.isFoundingPublisher
    ? FOUNDING_CREATOR_ROYALTY_NUMERATOR
    : STANDARD_CREATOR_ROYALTY_NUMERATOR;
  const den = options?.isFoundingPublisher
    ? FOUNDING_CREATOR_ROYALTY_DENOMINATOR
    : STANDARD_CREATOR_ROYALTY_DENOMINATOR;
  const creatorPayoutCents = Math.floor((gross * num) / den);
  const platformFeeCents = gross - creatorPayoutCents;
  const creatorRoyaltyPct = num / den;
  return { creatorPayoutCents, platformFeeCents, creatorRoyaltyPct };
}

/** @deprecated Use splitUnlockSale with options — kept for tests importing CREATOR_ROYALTY_* */
export const CREATOR_ROYALTY_NUMERATOR = STANDARD_CREATOR_ROYALTY_NUMERATOR;
export const CREATOR_ROYALTY_DENOMINATOR = STANDARD_CREATOR_ROYALTY_DENOMINATOR;
